// Allen-Bradley L5X File Handler (.L5X, .ACD)
import { saveAs } from 'file-saver'
import { js2xml, xml2js } from 'xml-js'
import type { LadderProgram } from '@/lib/ladder/parser'

export interface AllenBradleyProject {
  name: string
  processor: string
  rungs: Array<{
    number: number
    type: string
    comment: string
    text: string
  }>
  tags: Array<{
    name: string
    tagType: string
    dataType: string
    dimensions?: number
  }>
}

export async function parseAllenBradleyL5X(file: File): Promise<AllenBradleyProject> {
  const text = await file.text()
  const result: any = xml2js(text, { compact: true })

  const rsLogixContent = result.RSLogix5000Content
  const controller = rsLogixContent.Controller

  const project: AllenBradleyProject = {
    name: controller._attributes?.Name || 'Unnamed',
    processor: controller._attributes?.ProcessorType || 'Unknown',
    rungs: [],
    tags: []
  }

  // Parse Programs
  const programs = controller.Programs?.Program
  if (programs) {
    const programArray = Array.isArray(programs) ? programs : [programs]
    programArray.forEach((program: any) => {
      const routines = program.Routines?.Routine
      if (routines) {
        const routineArray = Array.isArray(routines) ? routines : [routines]
        routineArray.forEach((routine: any) => {
          const rllContent = routine.RLLContent
          if (rllContent?.Rung) {
            const rungs = Array.isArray(rllContent.Rung) ? rllContent.Rung : [rllContent.Rung]
            rungs.forEach((rung: any) => {
              project.rungs.push({
                number: parseInt(rung._attributes?.Number || '0'),
                type: rung._attributes?.Type || 'N',
                comment: rung.Comment?._text || '',
                text: rung.Text?._text || ''
              })
            })
          }
        })
      }
    })
  }

  // Parse Tags
  const tags = controller.Tags?.Tag
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags]
    tagArray.forEach((tag: any) => {
      project.tags.push({
        name: tag._attributes?.Name || '',
        tagType: tag._attributes?.TagType || 'Base',
        dataType: tag._attributes?.DataType || 'BOOL'
      })
    })
  }

  return project
}

export async function exportToAllenBradleyL5X(program: LadderProgram, projectName: string): Promise<Blob> {
  const l5xObject = {
    _declaration: {
      _attributes: {
        version: '1.0',
        encoding: 'UTF-8'
      }
    },
    RSLogix5000Content: {
      _attributes: {
        SchemaRevision: '1.0',
        SoftwareRevision: '32.00',
        TargetName: projectName,
        TargetType: 'Controller',
        ContainsContext: 'true',
        Owner: 'PLC Vibe',
        ExportDate: new Date().toISOString()
      },
      Controller: {
        _attributes: {
          Use: 'Target',
          Name: projectName,
          ProcessorType: 'CompactLogix',
          MajorRev: '32',
          MinorRev: '11'
        },
        Tags: {
          Tag: program.ioMap.map(io => ({
            _attributes: {
              Name: io.name.replace(/\s+/g, '_'),
              TagType: 'Base',
              DataType: 'BOOL',
              Radix: 'Decimal',
              Constant: 'false',
              ExternalAccess: 'Read/Write'
            }
          }))
        },
        Programs: {
          Program: {
            _attributes: {
              Name: 'MainProgram',
              Type: 'Normal',
              UseAsFolder: 'false'
            },
            Routines: {
              Routine: {
                _attributes: {
                  Name: 'MainRoutine',
                  Type: 'RLL'
                },
                RLLContent: {
                  Rung: program.networks.map(network => ({
                    _attributes: {
                      Number: network.id.toString(),
                      Type: 'N'
                    },
                    Comment: {
                      _text: network.label || ''
                    },
                    Text: {
                      _cdata: convertToLogix(network)
                    }
                  }))
                }
              }
            }
          }
        }
      }
    }
  }

  const xml = js2xml(l5xObject, {
    compact: true,
    spaces: 2,
    indentCdata: true
  })

  return new Blob([xml], { type: 'application/xml' })
}

function convertToLogix(network: any): string {
  let logix = ''

  network.elements.forEach((element: any, idx: number) => {
    switch (element.type) {
      case 'contact-no':
        logix += `XIC(${element.address})`
        break
      case 'contact-nc':
        logix += `XIO(${element.address})`
        break
      case 'coil':
        logix += `OTE(${element.address})`
        break
      case 'timer':
        logix += `TON(${element.address},${element.preset})`
        break
    }
  })

  return logix
}

export function downloadAllenBradleyProject(blob: Blob, filename: string) {
  saveAs(blob, filename.endsWith('.L5X') ? filename : `${filename}.L5X`)
}