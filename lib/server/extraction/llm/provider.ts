import 'server-only'

import { configuredLlmProvider } from '../config'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import { ClaudeProvider } from './claude-adapter'

export interface LlmProvider {
  extract(file: File): Promise<ExtractionResult>
}

export function resolveLlmProvider(): LlmProvider | null {
  const configured = configuredLlmProvider()
  return configured ? new ClaudeProvider(configured.apiKey, configured.model) : null
}
