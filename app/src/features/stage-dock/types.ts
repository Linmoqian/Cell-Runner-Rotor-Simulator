export const stagePalettes = ['mint', 'violet', 'amber', 'blue', 'rose'] as const

export type StagePalette = (typeof stagePalettes)[number]

export interface Stage {
  groupId?: string
  id: string
  palette: StagePalette
}

export interface StageGroup {
  id: string
  name: string
}
