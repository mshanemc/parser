import { IArg } from './args'
import { Flag, ValueFlag } from './flags'
import { validate } from './validate'
export type InputArgs = IArg[]
export interface InputFlags {
  [name: string]: Flag
}
export interface IInputOptions {
  argv?: string[]
  flags?: InputFlags
  args?: IArg[]
  output?: 'object' | 'array'
  strict?: boolean
}
export type InputOptions = IInputOptions & {
  argv: string[]
  flags: InputFlags
  args: InputArgs
  strict: boolean
}
export interface IOutputArg {
  type: 'arg'
  i: number
  input: string
  arg: IArg
}
export interface IOutputFlag {
  type: 'flag'
  flag: Flag
}
export interface IOutputValueFlag {
  type: 'valueflag'
  input: string
  flag: ValueFlag<any>
}
export type OutputArray = Array<IOutputArg | IOutputFlag | IOutputValueFlag>

function parseArray(input: InputOptions): OutputArray {
  const output: OutputArray = []
  const argv = input.argv.slice(0)
  let parsingFlags = true
  let argI = 0

  const findLongFlag = (arg: string) => {
    const name = arg.slice(2)
    if (input.flags[name]) {
      return name
    }
  }

  const findShortFlag = (arg: string) => {
    return Object.keys(input.flags).find(k => input.flags[k].char === arg[1])
  }

  const parseFlag = (arg: string): boolean => {
    const long = arg.startsWith('--')
    const name = long ? findLongFlag(arg) : findShortFlag(arg)
    if (!name) {
      const i = arg.indexOf('=')
      if (i !== -1) {
        const sliced = arg.slice(i + 1)
        argv.unshift(sliced)

        const equalsParsed = parseFlag(arg.slice(0, i))
        if (!equalsParsed) {
          argv.shift()
        }
        return equalsParsed
      }
      return false
    }
    const flag = input.flags[name]
    if (flag instanceof ValueFlag) {
      let value
      if (long || arg.length < 3) {
        value = argv.shift()
      } else {
        value = arg.slice(arg[2] === '=' ? 3 : 2)
      }
      if (!value) {
        throw new Error(`Flag --${name} expects a value`)
      }
      output.push({ type: 'valueflag', input: value, flag })
    } else {
      output.push({ type: 'flag', flag })
      // push the rest of the short characters back on the stack
      if (!long && arg.length > 2) {
        argv.unshift(`-${arg.slice(2)}`)
      }
    }
    return true
  }

  while (argv.length) {
    const arg = argv.shift() as string
    if (parsingFlags && arg.startsWith('-')) {
      // attempt to parse as arg
      if (arg === '--') {
        parsingFlags = false
        continue
      }
      if (parseFlag(arg)) {
        continue
      }
      // not actually a flag if it reaches here so parse as an arg
    }
    // not a flag, parse as arg
    output.push({ type: 'arg', i: argI, input: arg, arg: input.args[argI] })
    argI++
  }
  return output
}

// tslint:disable-next-line:interface-over-type-literal
export type OutputArgs = {
  [name: string]: any
}

// tslint:disable-next-line:interface-over-type-literal
export type OutputFlags = {
  [name: string]: any
}
export interface IOutput {
  flags: OutputFlags
  args: OutputArgs
  argv: string[]
}

function setNames(flags: InputFlags) {
  for (const name of Object.keys(flags)) {
    flags[name].name = name
  }
}

function buildOutputFromArray(arr: OutputArray): IOutput {
  return arr.reduce(
    (obj, elem) => {
      switch (elem.type) {
        case 'valueflag':
          if (elem.flag.multiple) {
            obj.flags[elem.flag.name] = obj.flags[elem.flag.name] || []
            obj.flags[elem.flag.name].push(elem.flag.parse(elem.input))
          } else {
            obj.flags[elem.flag.name] = elem.flag.parse(elem.input)
          }
          break
        case 'flag':
          obj.flags[elem.flag.name] = true
          break
        case 'arg':
          obj.argv.push(elem.input)
          if (elem.arg) {
            obj.args[elem.arg.name] = elem.input
          }
          break
      }
      return obj
    },
    {
      args: {},
      argv: [],
      flags: {},
    } as IOutput,
  )
}

export function parse(options: IInputOptions & { output?: 'object' }): IOutput
export function parse(options: IInputOptions & { output: 'array' }): OutputArray
export function parse(options: IInputOptions): any {
  const input: InputOptions = {
    args: [],
    argv: process.argv.slice(2),
    flags: {},
    ...options,
    strict: options.strict !== false,
  }
  setNames(input.flags)
  const arr = parseArray(input)
  validate(input, arr)
  if (input.output === 'array') {
    return arr
  }
  return buildOutputFromArray(arr)
}
