import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
let div
function getShouldDecode(href: boolean): boolean {
  div = div || document.createElement('div')
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  // &#10; 是一个 HTML 实体字符，表示换行符
  return div.innerHTML.indexOf('&#10;') > 0
}

// #3663: IE encodes newlines inside attribute values while other browsers don't
// IE 会将attribute value中的换行符编码, 而其他浏览器不会
export const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false
// #6828: chrome encodes content in a[href]
// chrome 会编码href中的你内容
export const shouldDecodeNewlinesForHref = inBrowser
  ? getShouldDecode(true)
  : false
