import 'server-only'

import { configuredLlmProvider } from '../config'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProviderId } from '../config'
import { ClaudeProvider } from './claude-adapter'
import { DeepseekProvider } from './deepseek-adapter'
import { SumopodProvider } from './sumopod-adapter'

export interface LlmProvider {
  readonly id: LlmProviderId
  extract(file: File): Promise<ExtractionResult>
}

export function resolveLlmProvider(): LlmProvider | null {
  const configured = configuredLlmProvider()
  if (!configured) return null
  switch (configured.id) {
    case 'CLAUDE':
      return new ClaudeProvider(configured.apiKey, configured.model)
    case 'DEEPSEEK':
      return new DeepseekProvider(configured.apiKey, configured.model)
    case 'SUMOPOD':
      return new SumopodProvider(configured.apiKey, configured.model)
  }
}
