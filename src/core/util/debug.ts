import config from '../config'
import { noop, isArray, isFunction } from 'shared/util'
import type { Component } from 'types/component'
import { currentInstance } from 'v3/currentInstance'
import { getComponentName } from '../vdom/create-component'

export let warn: (msg: string, vm?: Component | null) => void = noop
export let tip = noop
export let generateComponentTrace: (vm: Component) => string // work around flow check
export let formatComponentName: (vm: Component, includeFile?: false) => string

if (__DEV__) {
  const hasConsole = typeof console !== 'undefined'

  const classifyRE = /(?:^|[-_])(\w)/g
  // 接受一个字符串参数，并将其转换为"驼峰式"命名格式，即将字符串中的下划线或破折号分隔符去掉，并将每个单词的首字母大写
  const classify = str =>
    str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

  warn = (msg, vm = currentInstance) => {
    const trace = vm ? generateComponentTrace(vm) : ''

    if (config.warnHandler) {
      config.warnHandler.call(null, msg, vm, trace)
    } else if (hasConsole && !config.silent) {
      console.error(`[Vue warn]: ${msg}${trace}`)
    }
  }

  tip = (msg, vm) => {
    if (hasConsole && !config.silent) {
      console.warn(`[Vue tip]: ${msg}` + (vm ? generateComponentTrace(vm) : ''))
    }
  }

  /**
   * 函数的目的是根据给定的组件对象生成一个格式化的组件名称字符串，该字符串包含组件的名称和文件路径（如果第二个参数为true）。
   */ 
  formatComponentName = (vm, includeFile) => {
    if (vm.$root === vm) {
      return '<Root>'
    }

    // 尝试获取组件定义选项
    const options =
      isFunction(vm) && (vm as any).cid != null
        ? (vm as any).options
        : vm._isVue
        ? vm.$options || (vm.constructor as any).options
        : vm
      
    // 获取组件名称
    let name = getComponentName(options)
    // 获取文件路径
    const file = options.__file
    if (!name && file) {
      //取文件名
      const match = file.match(/([^/\\]+)\.vue$/)
      name = match && match[1]
    }

    return (
      // classify 将名称转为驼峰式命名
      (name ? `<${classify(name)}>` : `<Anonymous>`) +
      (file && includeFile !== false ? ` at ${file}` : '')
    )
  }

  /**
   * 这个重复函数使用了一种名为"位运算"的技巧，通过将n转换为二进制数并逐位检查其值来实现字符串重复的功能。相较于普通的一直循环n次的重复函数，该函数具有以下优点：
   * 1. 效率更高：
   *    该函数的实现依赖于位运算，而非循环语句。位运算是计算机硬件中的基本操作，因此执行速度非常快。相比之下，循环语句需要进行多次比较、递增和跳转操作，执行速度较慢。
   * 2. 代码更简洁：
   *    该函数的实现非常简洁，只使用了while循环和位运算，代码行数很少。相比之下，普通的一直循环n次的重复函数需要使用for循环或while循环，并且需要进行多次字符串拼接操作，
   *    代码行数较多
   * 3. 更易于理解和维护：
   *    该函数的实现依赖于位运算，这可能使得代码对于不熟悉位运算的开发人员来说难以理解。但是，一旦理解了位运算的原理，代码的逻辑就非常清晰，易于维护和调试。相比之下，
   *    普通的一直循环n次的重复函数的逻辑可能会更加复杂，使得代码更难以理解和维护。
   * 
   * 原理:
   *    当我们需要将一个字符串重复n次时，通常的做法是使用循环语句，例如for循环或while循环，将字符串拼接n次。这种做法的时间复杂度为O(n)，即需要进行n次字符串拼接操作。
   *    但是，当n非常大时，这种做法的性能可能会变得很差。
   * 
   *    基于位运算的重复函数的原理是，将n转换为二进制数，并逐位检查其值。例如，当n=11时，其二进制表示为1011。我们可以从右向左逐位检查这个二进制数，如果当前位的值为1，
   *    则将字符串添加到结果字符串中。接着，将字符串重复一次，以便在下一次循环中将其添加到结果字符串中。然后，将n右移一位，以便在下一次循环中检查下一个二进制位。
   *    这样做的原因是，当n为偶数时，其二进制数的最后一位必定为0，因此不需要进行字符串拼接操作。而当n为奇数时，其二进制数的最后一位必定为1，需要进行一次字符串拼接操作。
   *    接着，将n右移一位，相当于将二进制数的最后一位删除，同时将n除以2。
   *    这个重复函数的实现使用了位运算技巧，使得在n较大时，其性能会比一直循环n次的重复函数更好。例如，当n=1000000时，它只需要进行20次字符串拼接操作，而一直循环n次的
   *    重复函数需要进行1000000次字符串拼接操作。同时，这个实现也非常简洁，只使用了while循环和位运算。 
   *   
   *    这个算法也被广泛应用于其他JavaScript类库和框架中，例如Lodash、Underscore.js、React等。在这些类库和框架中，该算法通常被用于字符串重复、生成唯一的ID等场景。
   */
  const repeat = (str, n) => {
    let res = ''
    while (n) {
      if (n % 2 === 1) res += str
      if (n > 1) str += str
      n >>= 1
    }
    return res
  }

  /*
   * 函数接受一个Vue组件对象作为参数，然后根据该组件的层次结构生成一个组件调用堆栈跟踪信息。
   */
  generateComponentTrace = (vm: Component | undefined) => {

    // 检查传入的组件对象是否为Vue组件，并且是否具有父组件
    if ((vm as any)._isVue && vm!.$parent) {// 是vue组件, 并且有父组件
      const tree: any[] = []
      // 记录当前递归序号
      let currentRecursiveSequence = 0

      // 使用while循环遍历该组件的父组件链，并将每个组件对象添加到一个数组中（称为"tree"）
      while (vm) {
        if (tree.length > 0) {
          const last = tree[tree.length - 1]
          // 如果遇到相同的组件，则将计数器递增
          if (last.constructor === vm.constructor) {
            currentRecursiveSequence++
            // 最后叹号是TypeScript中的非空断言操作符（Non-null Assertion Operator）。它的作用是告诉编译器，变量或属性不会为null或undefined，并强制编译器将其视为非空值。
            vm = vm.$parent!
            continue
          } 
          //如果不同组件, 则将该组件及其递归调用次数（如果有）添加到数组中
          else if (currentRecursiveSequence > 0) {
            tree[tree.length - 1] = [last, currentRecursiveSequence]
            currentRecursiveSequence = 0
          }

        }
        tree.push(vm)
        vm = vm.$parent!
      }


      // 利用i和repeat函数形成缩进, 当vm是数组时, vm[1]存放的是递归的次数
      return (
        '\n\nfound in\n\n' +
        tree
          .map(
            (vm, i) =>
              `${i === 0 ? '---> ' : repeat(' ', 5 + i * 2)}${
                isArray(vm)
                  ? `${formatComponentName(vm[0])}... (${
                      vm[1]
                    } recursive calls)`
                  : formatComponentName(vm)
              }`
          )
          .join('\n')
      )
    } else {
      return `\n\n(found in ${formatComponentName(vm!)})`
    }
  }
}
