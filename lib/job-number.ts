import { prisma } from '@/lib/prisma'
export async function generateJobNumber() { const year = new Date().getFullYear(); const count = await prisma.job.count({ where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } } }); return `VSS-${year}-${String(count + 1).padStart(3, '0')}` }
