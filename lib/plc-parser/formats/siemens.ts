// Siemens S7 Project File Handler (.s7p, .zap16)
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { LadderProgram } from '@/lib/ladder/parser'

export interface SiemensProject {
  name: string
  version: string
  networks: Array<{
    id: number
    title: string
    awl: string // AWL (Statement List) code
  }>
  symbols: Array<{
    address: string
    name: string
    type: string
    comment?: string
  }>
}

export async function parseSiemensS7File(file: File): Promise<SiemensProject> {
  const zip = new JSZip()
  const content = await zip.loadAsync(file)

  const project: SiemensProject = {
    name: file.name.replace(/\.(s7p|zap16)$/, ''),
    version: '1.0',
    networks: [],
    symbols: []
  }

  // Parse project structure
  const projectFile = content.file(/\.s7p$/i)[0]
  if (projectFile) {
    const xmlContent = await projectFile.async('string')
    // Parse XML and extract networks
    // This is simplified - real S7 files are more complex
  }

  return project
}

export async function exportToSiemensS7(program: LadderProgram, projectName: string): Promise<Blob> {
  const zip = new JSZip()

  // Create project structure
  const projectXML = generateProjectXML(program, projectName)
  zip.file(`${projectName}.s7p`, projectXML)

  // Create AWL (Statement List) files for each network
  program.networks.forEach((network, idx) => {
    const awl = convertToAWL(network)
    zip.file(`Networks/Network_${idx + 1}.awl`, awl)
  })

  // Create symbol table
  const symbolTable = generateSymbolTable(program.ioMap)
  zip.file('SymbolTable.sdf', symbolTable)

  // Generate zip file
  return await zip.generateAsync({ type: 'blob' })
}

function generateProjectXML(program: LadderProgram, projectName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://www.siemens.com/automation/Openness/SW/Interface/v1">
  <Name>${projectName}</Name>
  <Version>16</Version>
  <Author>PLC Vibe</Author>
  <CreationDate>${new Date().toISOString()}</CreationDate>
  <Device>
    <Name>PLC_1</Name>
    <Type>CPU 1515-2 PN</Type>
  </Device>
  <Software>
    <BlockContainer>
      <ProgramBlock Name="Main" Type="OB">
        <Number>1</Number>
        <Networks>${program.networks.length}</Networks>
      </ProgramBlock>
    </BlockContainer>
  </Software>
</Project>`
}

function convertToAWL(network: any): string {
  let awl = `// Network ${network.id}: ${network.label || ''}\n`

  network.elements.forEach((element: any) => {
    switch (element.type) {
      case 'contact-no':
        awl += `      A    "${element.address}"\n`
        break
      case 'contact-nc':
        awl += `      AN   "${element.address}"\n`
        break
      case 'coil':
        awl += `      =    "${element.address}"\n`
        break
      case 'timer':
        awl += `      L    S5T#${element.preset}MS\n`
        awl += `      TON  "${element.address}"\n`
        break
    }
  })

  return awl
}

function generateSymbolTable(ioMap: any[]): string {
  let sdf = '126,0,1,PLCTags\n'
  sdf += '126,1,1,Symbol,Address,DataType,Comment\n'

  ioMap.forEach(io => {
    const dataType = io.type.includes('I') ? 'Bool' : 'Bool'
    sdf += `126,2,1,"${io.name}","${io.address}",${dataType},"${io.description || ''}"\n`
  })

  return sdf
}

export function downloadSiemensProject(blob: Blob, filename: string) {
  saveAs(blob, filename.endsWith('.zap16') ? filename : `${filename}.zap16`)
}