import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const prisma = new PrismaClient();
const anthropic = new Anthropic();

/**
 * Detects if the text is primarily in English
 */
function isEnglish(text: string): boolean {
  // Simple heuristic: check for Japanese characters
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  return !hasJapanese && text.length > 10;
}

/**
 * Translate reasoning text from English to Japanese
 */
async function translateToJapanese(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `以下の脅威分析の説明文を日本語に翻訳してください。技術用語は適切に訳し、自然な日本語にしてください。

翻訳する文章:
${text}

翻訳結果のみを出力してください（説明は不要）:`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : text;
}

async function run() {
  console.log('🔍 Searching for English reasoning in ThreatAnalysis...');

  const analyses = await prisma.threatAnalysis.findMany({
    select: { id: true, reasoning: true },
  });

  const englishAnalyses = analyses.filter((a) => isEnglish(a.reasoning));
  console.log(`   Found ${englishAnalyses.length} records with English reasoning`);

  for (const analysis of englishAnalyses) {
    console.log(`\n--- Translating ThreatAnalysis ${analysis.id} ---`);
    console.log(`   Original: ${analysis.reasoning.slice(0, 100)}...`);

    try {
      const translated = await translateToJapanese(analysis.reasoning);
      console.log(`   Translated: ${translated.slice(0, 100)}...`);

      await prisma.threatAnalysis.update({
        where: { id: analysis.id },
        data: { reasoning: translated },
      });
      console.log('   ✅ Updated');
    } catch (e) {
      console.error(`   ❌ Error:`, e);
    }
  }

  console.log('\n🔍 Searching for English reasoning in FreeDiagnosis...');

  const diagnoses = await prisma.freeDiagnosis.findMany({
    where: { reasoning: { not: null } },
    select: { id: true, reasoning: true },
  });

  const englishDiagnoses = diagnoses.filter((d) => d.reasoning && isEnglish(d.reasoning));
  console.log(`   Found ${englishDiagnoses.length} records with English reasoning`);

  for (const diagnosis of englishDiagnoses) {
    if (!diagnosis.reasoning) continue;

    console.log(`\n--- Translating FreeDiagnosis ${diagnosis.id} ---`);
    console.log(`   Original: ${diagnosis.reasoning.slice(0, 100)}...`);

    try {
      const translated = await translateToJapanese(diagnosis.reasoning);
      console.log(`   Translated: ${translated.slice(0, 100)}...`);

      await prisma.freeDiagnosis.update({
        where: { id: diagnosis.id },
        data: { reasoning: translated },
      });
      console.log('   ✅ Updated');
    } catch (e) {
      console.error(`   ❌ Error:`, e);
    }
  }

  console.log('\n✅ Translation complete');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
