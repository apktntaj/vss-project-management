import 'server-only'

import { configuredLlmProvider } from '../config'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProviderId } from '../config'
import { GeminiProvider } from './gemini-adapter'
import { ClaudeProvider } from './claude-adapter'
import { DeepseekProvider } from './deepseek-adapter'

export interface LlmProvider {
  readonly id: LlmProviderId
  extract(file: File): Promise<ExtractionResult>
}

export function resolveLlmProvider(): LlmProvider | null {
  const configured = configuredLlmProvider()
  if (!configured) return null
  switch (configured.id) {
    case 'GEMINI':
      return new GeminiProvider(configured.apiKey)
    case 'CLAUDE':
      return new ClaudeProvider(configured.apiKey)
    case 'DEEPSEEK':
      return new DeepseekProvider(configured.apiKey)
  }
}
