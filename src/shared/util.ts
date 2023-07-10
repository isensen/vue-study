// emptyObject是一个没有任何属性的空对象, Object.freeze方法会冻结一个对象，使其不可变。这意味着无法向该对象添加、删除或修改属性
export const emptyObject: Record<string, any> = Object.freeze({})

export const isArray = Array.isArray

// These helpers produce better VM code in JS engines due to their
// explicitness and function inlining.
// 在函数的声明中，使用了类型谓词v is undefined | null，它表示如果函数返回true，则表示参数v的类型是undefined或null。这样做有助
// 于提高代码的类型安全性，避免对非空值使用undefined或null的方法或属性。
export function isUndef(v: any): v is undefined | null {
  return v === undefined || v === null
}

// 定义了一个名为isDef的函数，它接受一个泛型类型的参数v，并返回一个类型谓词，用于指示参数v是否为非空类型。
export function isDef<T>(v: T): v is NonNullable<T> {
  return v !== undefined && v !== null
}

export function isTrue(v: any): boolean {
  return v === true
}

export function isFalse(v: any): boolean {
  return v === false
}

/**
 * Check if value is primitive.
 */
export function isPrimitive(value: any): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    // $flow-disable-line
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  )
}

// 为什么不用function isFunction(value: any): boolean
// value is (...args: any[]) => any 是  TypeScript 中的类型谓词语法 ，它表示这个函数会在运行时检查传入的参数 value 是否是一个函数，并返回一个布尔值。
// 这个类型谓词语法可以帮助 TypeScript 在后续的代码中推断出参数的精确类型，从而提供更严格的类型检查。
// 它可以提供更严格的类型检查和更精确的类型推断
export function isFunction(value: any): value is (...args: any[]) => any {
  return typeof value === 'function'
}

/**
 * Quick object check - this is primarily used to tell
 * objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
export function isObject(obj: any): boolean {
  return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value, e.g., [object Object].
 */
const _toString = Object.prototype.toString

export function toRawType(value: any): string {
  return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
export function isPlainObject(obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

export function isRegExp(v: any): v is RegExp {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
export function isValidArrayIndex(val: any): boolean {
  const n = parseFloat(String(val))
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

// 检查传入的对象是否是Promise
export function isPromise(val: any): val is Promise<any> {
  return (
    isDef(val) &&
    typeof val.then === 'function' &&
    typeof val.catch === 'function'
  )
}

/**
 * Convert a value to a string that is actually rendered.
 */
export function toString(val: any): string {
  return val == null
    ? ''
    : Array.isArray(val) || (isPlainObject(val) && val.toString === _toString)
    ? JSON.stringify(val, null, 2)
    : String(val)
}

/**
 * Convert an input value to a number for persistence.
 * If the conversion fails, return original string.
 */
export function toNumber(val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * 返回一个函数,来验证参数是否在map里...
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | undefined {
  const map = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => map[val.toLowerCase()] : val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 */
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if an attribute is a reserved attribute.
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * 从数组中删除指定项的函数，其输入参数包括一个数组 arr 和要删除的项 item 
 */
export function remove(arr: Array<any>, item: any): Array<any> | void {
  const len = arr.length
  if (len) {
    // fast path for the only / last item
    if (item === arr[len - 1]) {
      arr.length = len - 1
      return
    }
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether an object has the property.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn(obj: Object | Array<any>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 * 用于创建一个纯函数的缓存版本。它接受一个参数 fn，它是一个纯函数，它的输入为一个字符串，输出为一个任意类型的值。cached 函数返回一个新函数 cachedFn，
 * 它也接受一个字符串参数，并返回 fn 函数对该字符串的计算结果
 */
export function cached<R>(fn: (str: string) => R): (sr: string) => R {
  const cache: Record<string, R> = Object.create(null)
  return function cachedFn(str: string) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }
}

/**
 * Camelize a hyphen-delimited string.
 * 连字符变驼峰式
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})

/**
 * Capitalize a string.
 */
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 * 将驼峰式字符串转换为连字符（短横线）风格的字符串。
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * Simple bind polyfill for environments that do not support it,
 * e.g., PhantomJS 1.x. Technically, we don't need this anymore
 * since native bind is now performant enough in most browsers.
 * But removing it would mean breaking code that was able to run in
 * PhantomJS 1.x, so this must be kept for backward compatibility.
 */

/* istanbul ignore next */
function polyfillBind(fn: Function, ctx: Object): Function {
  function boundFn(a: any) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }

  boundFn._length = fn.length
  return boundFn
}

function nativeBind(fn: Function, ctx: Object): Function {
  return fn.bind(ctx)
}

// @ts-expect-error bind cannot be `undefined`
export const bind = Function.prototype.bind ? nativeBind : polyfillBind

/**
 * Convert an Array-like object to a real Array.
 */
export function toArray(list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 */
export function extend(
  to: Record<PropertyKey, any>,
  _from?: Record<PropertyKey, any>
): Record<PropertyKey, any> {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
export function toObject(arr: Array<any>): object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/* eslint-disable no-unused-vars */

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/).
 * 这段代码定义了一个名为 noop 的函数，它没有任何实际操作，只是为了让 Flow 在不产生无用转换代码的情况下保持正常运行。
 * 
 * 这个函数的主要作用是占位，它可以在需要传递函数作为参数的情况下使用，以避免在没有传递函数时出现错误。
 * 例如，如果有一个函数需要传递一个回调函数作为参数，但是调用该函数时不需要传递回调函数，就可以使用 noop 函数作为占位符，以保证代码的正确性和可读性。
 */
export function noop(a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 * 这个函数的主要作用是用作默认的否定判断
 * 例如在条件判断时需要提供一个默认值，或者在函数中需要返回一个布尔值但不需要进行实际的计算时可以使用这个函数
 * 这种方式可以避免在没有明确的否定条件时出现错误，同时提高代码的可读性和可维护性。
 */
export const no = (a?: any, b?: any, c?: any) => false

/* eslint-enable no-unused-vars */

/**
 * Return the same value.
 * 作默认的返回函数，例如在需要对某个值进行转换或处理时，可以使用这个函数将其返回原值
 * 例: 如果没有传入 transform 参数，那么默认使用 identity 函数，将 value 原样返回。如果传入了 transform 参数，那么就会使用传入的函数对 value 进行处理，
 * 并将处理后的结果返回
 * function doSomething(value, transform = identity) {
 *    const transformedValue = transform(value)
 *    // Do something with transformedValue
 * }
 */
export const identity = (_: any) => _

/**
 * Generate a string containing static keys from compiler modules.
 */
export function genStaticKeys(
  modules: Array<{ staticKeys?: string[] } /* ModuleOptions */>
): string {
  return modules
    .reduce<string[]>((keys, m) => keys.concat(m.staticKeys || []), [])
    .join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
export function looseEqual(a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      const isArrayA = Array.isArray(a)
      const isArrayB = Array.isArray(b)
      if (isArrayA && isArrayB) {
        return (
          a.length === b.length &&
          a.every((e: any, i: any) => {
            return looseEqual(e, b[i])
          })
        )
      } else if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime()
      } else if (!isArrayA && !isArrayB) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        return (
          keysA.length === keysB.length &&
          keysA.every(key => {
            return looseEqual(a[key], b[key])
          })
        )
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e: any) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

/**
 * Return the first index at which a loosely equal value can be
 * found in the array (if value is a plain object, the array must
 * contain an object of the same shape), or -1 if it is not present.
 */
export function looseIndexOf(arr: Array<unknown>, val: unknown): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments as any)
    }
  } as any
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is#polyfill
export function hasChanged(x: unknown, y: unknown): boolean {
  if (x === y) {
    return x === 0 && 1 / x !== 1 / (y as number)
  } else {
    return x === x || y === y
  }
}
