/**
 * unicode letters used for parsing html tags, component names and property paths.
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * skipping \u10000-\uEFFFF due to it freezing up PhantomJS
 * 这是一个常量定义，用于解析 HTML 标签、组件名称和属性路径时使用的 Unicode 字符集。 
 * 该字符集是按照 HTML5 规范中关于潜在自定义元素名称的定义进行定义的。其中包含了大量的 Unicode 字符，如拉丁字母、希腊字母、标点符号等等。其中有一些范围被跳过了，
 * 因为它们可能会导致 PhantomJS 卡死。
 * 该常量的作用是为了确保在解析 HTML 标签、组件名称和属性路径时，只使用规范允许的 Unicode 字符，避免出现不必要的问题。
 */
export const unicodeRegExp =
  /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/

/**
 * Check if a string starts with $ or _
 */
export function isReserved(str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5f
}

/**
 * Define a property.
 */
export function def(obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 * 解析简单路径的函数，
 * 例如，对于一个对象 obj，路径为 a.b.c，则表示要获取 obj.a.b.c 的值。
 * 函数会将路径分割成三个段落 a、b 和 c，并创建一个闭包函数来解析路径。
 * 在闭包函数内部，函数会依次获取 obj.a、obj.a.b 和 obj.a.b.c 的值，并返回最终解析出来的值
 */
const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`)
export function parsePath(path: string): any {
  // 用于确定路径中是否包含非法字符。如果路径中包含了非法字符，函数将直接返回。
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
