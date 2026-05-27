import dotenv from 'dotenv';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_TOKENS = 400;
const OVERLAP_TOKENS = 50;
const TOKENS_PER_WORD = 1.3;

// Estimate token count (rough approximation)
function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).length * TOKENS_PER_WORD);
}

// Split text into chunks with overlap on sentence boundaries
function createChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const testChunk = currentChunk + sentence;
    const tokenCount = estimateTokens(testChunk);

    if (tokenCount > MAX_TOKENS && currentChunk) {
      chunks.push(currentChunk.trim());

      let overlapText = '';
      const overlapSentences = sentences
        .slice(sentences.indexOf(sentence))
        .reverse();

      for (const overlapSent of overlapSentences) {
        const testOverlap = overlapSent + overlapText;
        if (estimateTokens(testOverlap) <= OVERLAP_TOKENS) {
          overlapText = testOverlap;
        } else {
          break;
        }
      }

      currentChunk = overlapText;
    }

    currentChunk += sentence;
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Download PDF from URL or read from local file
async function getPdfBuffer(company) {
  if (company.typ === 'pdf') {
    try {
      const response = await axios.get(company.villkor_url, { responseType: 'arraybuffer' });
      return response.data;
    } catch (error) {
      throw new Error(`Kunde inte ladda PDF från URL: ${error.message}`);
    }
  } else if (company.typ === 'manuell') {
    const filename = company.bolag.toLowerCase().replace(/\s+/g, '') + '.pdf';
    const filepath = path.join('ingest', 'pdf', filename);
    try {
      return await fs.readFile(filepath);
    } catch (error) {
      throw new Error(`Lokal fil hittades inte: ${filepath}`);
    }
  }
  throw new Error(`Okänd typ: ${company.typ}`);
}

// Extract text from PDF buffer
async function extractPdfText(pdfBuffer) {
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  let text = '';

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    text += textContent.items.map(item => item.str).join(' ') + '\n';
  }

  return { text, numPages: pdfDoc.numPages };
}

// Sanitize text for API (remove problematic Unicode)
function sanitizeText(text) {
  // Strategy: keep ASCII 32-126 (printable) + Swedish chars (åäöÅÄÖ)
  // Strip everything else to avoid OpenAI JSON encoding issues
  let clean = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const char = text[i];
    // Keep ASCII 32-126, or Swedish letters
    if ((code >= 32 && code <= 126) || 'åäöÅÄÖ'.includes(char)) {
      clean += char;
    } else {
      clean += ' ';
    }
  }
  return clean.replace(/\s+/g, ' ').trim();
}

// Create embedding for text
async function createEmbedding(text) {
  const cleanText = sanitizeText(text);
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
      dimensions: 1536,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    console.error('Text length:', cleanText.length);
    console.error('Text (first 200):', cleanText.substring(0, 200));
    throw error;
  }
}

// Ingest single company
async function ingestBolag(company, index) {
  const prefix = `[${index}/${totalBolag}]`;

  // Skip validation
  if (company.villkor_url === null && company.typ !== 'manuell') {
    console.log(`\n${prefix} ⏭️  ${company.bolag}`);
    console.log(`  ⚠️  Hoppad över — ingen URL och typ är inte "manuell"`);
    return { status: 'skipped', reason: 'no_url' };
  }

  console.log(`\n${prefix} 📄 ${company.bolag} (typ: ${company.typ})`);

  try {
    // Get PDF buffer
    let pdfBuffer;
    let sourceInfo = '';

    if (company.typ === 'manuell') {
      const filename = company.bolag.toLowerCase().replace(/\s+/g, '') + '.pdf';
      const filepath = path.join('ingest', 'pdf', filename);
      try {
        pdfBuffer = await fs.readFile(filepath);
        sourceInfo = `från lokal fil (${filename})`;
      } catch (error) {
        console.log(`  ❌ Lokal fil hittades inte: ${filepath}`);
        return { status: 'failed', reason: 'file_not_found', error: filepath };
      }
    } else {
      console.log(`  📥 Laddar ned PDF från URL...`);
      try {
        const response = await axios.get(company.villkor_url, { responseType: 'arraybuffer', timeout: 10000 });
        pdfBuffer = response.data;
        sourceInfo = `från URL`;
      } catch (error) {
        console.log(`  ❌ Kunde inte ladda PDF: ${error.message}`);
        return { status: 'failed', reason: 'download_failed', error: error.message };
      }
    }

    // Extract text
    console.log(`  📖 Extraherar text${sourceInfo ? ' ' + sourceInfo : ''}...`);
    const { text, numPages } = await extractPdfText(pdfBuffer);
    console.log(`     ✅ Extraherad från ${numPages} sidor`);

    // Create chunks
    const chunks = createChunks(text);
    console.log(`  🔀 Skapade ${chunks.length} stycken`);

    // Check if document exists
    const { data: existingDocs } = await supabase
      .from('policy_documents')
      .select('id')
      .eq('bolag', company.bolag);

    let documentId;

    if (existingDocs && existingDocs.length > 0) {
      documentId = existingDocs[0].id;
      await supabase
        .from('policy_chunks')
        .delete()
        .eq('document_id', documentId);

      console.log(`  🔄 Uppdaterar befintligt dokument...`);

      await supabase
        .from('policy_documents')
        .update({
          senast_ingest: new Date().toISOString(),
        })
        .eq('id', documentId);
    } else {
      console.log(`  ➕ Skapar nytt dokument...`);

      const { data, error } = await supabase
        .from('policy_documents')
        .insert({
          bolag: company.bolag,
          produkt: company.produkt || null,
          villkor_url: company.villkor_url,
          senast_ingest: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      documentId = data.id;
    }

    // Process chunks
    console.log(`  🧠 Skapar embeddings...`);
    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      try {
        const embedding = await createEmbedding(content);

        const { error } = await supabase
          .from('policy_chunks')
          .insert({
            document_id: documentId,
            bolag: company.bolag,
            chunk_index: i,
            content: content,
            embedding: embedding,
          });

        if (error) throw error;
        successCount++;
      } catch (chunkError) {
        console.log(`\n  ⚠️  Stycke ${i} hoppat över: ${chunkError.message}`);
        // Continue to next chunk instead of failing entire document
      }

      if ((i + 1) % Math.ceil(chunks.length / 3) === 0 || i === chunks.length - 1) {
        console.log(`     → ${i + 1}/${chunks.length} stycken sparade`);
      }
    }

    console.log(`  ✅ ${company.bolag} klart!`);
    return { status: 'success', chunks: chunks.length };

  } catch (error) {
    console.log(`  ❌ Fel: ${error.message}`);
    return { status: 'failed', reason: 'processing_error', error: error.message };
  }
}

// Main ingest process
async function main() {
  console.log('🚀 RAG Ingest Pipeline för Livförsäkringar.se\n');
  console.log('═'.repeat(60));

  // Load bolag configuration
  let bolagList;
  try {
    const bolagData = await fs.readFile('ingest/bolag.json', 'utf-8');
    bolagList = JSON.parse(bolagData);
    console.log(`\n📋 Laddat ${bolagList.length} bolag från ingest/bolag.json\n`);
  } catch (error) {
    console.error('❌ Kunde inte läsa ingest/bolag.json:', error.message);
    process.exit(1);
  }

  // Global for logging
  globalThis.totalBolag = bolagList.length;

  // Process each company
  const results = [];
  for (let i = 0; i < bolagList.length; i++) {
    const result = await ingestBolag(bolagList[i], i + 1);
    results.push({ bolag: bolagList[i].bolag, ...result });
  }

  console.log('\n═'.repeat(60));
  console.log('\n📊 SAMMANFATTNING:\n');

  const succeeded = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped');

  console.log(`✅ LYCKADES (${succeeded.length}):`);
  succeeded.forEach(r => {
    console.log(`   • ${r.bolag}: ${r.chunks} stycken`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ MISSLYCKADES (${failed.length}):`);
    failed.forEach(r => {
      console.log(`   • ${r.bolag}: ${r.reason} — ${r.error}`);
    });
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️  HOPPADE ÖVER (${skipped.length}):`);
    skipped.forEach(r => {
      console.log(`   • ${r.bolag}: ${r.reason}`);
    });
  }

  // Verify data in Supabase
  console.log('\n' + '═'.repeat(60));
  console.log('\n📈 VERIFIKATION I SUPABASE:\n');

  const { count: docsCount, error: docsError } = await supabase
    .from('policy_documents')
    .select('*', { count: 'exact', head: true });

  const { count: chunksCount, error: chunksError } = await supabase
    .from('policy_chunks')
    .select('*', { count: 'exact', head: true });

  if (!docsError) {
    console.log(`  📄 policy_documents: ${docsCount} dokument`);
  }

  if (!chunksError) {
    console.log(`  🔤 policy_chunks: ${chunksCount} stycken totalt`);
  }

  console.log('\n✨ Ingest slutfört!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
