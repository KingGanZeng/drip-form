/*
 * @Author: jiangxiaowei
 * @Date: 2020-05-30 15:05:13
 * @Last Modified by: jiangxiaowei
 * @Last Modified time: 2021-11-24 21:10:39
 */
import type { TreeItems, TreeItem } from '../tree/types'
import type { Map } from './type'

/**
 * 生成fieldkey的正则
 * 根据a.0.b 返回/a.(\d+|$container).b/正则
 * @param arr <Array> 需要生成正则的数组
 * @returns 返回正则
 */
export const generateReg = (arr: Array<string>): RegExp => {
  const regStr = arr.reduce((prev: string, cur: string, index, arr) => {
    if (Number.isNaN(parseInt(cur))) {
      return `${prev}${index !== 0 ? '\\.' : ''}${arr[index].replace(
        /\$/g,
        '\\$'
      )}`
    } else {
      return `${index !== 0 ? `${prev}\\.` : ''}(${cur}|\\$container)`
    }
  }, '')
  return new RegExp(`^${regStr}$`, 'ig')
}

/**
 * 基本数据类型检测
 * @param {unknown} checkVar 待检测的变量
 * @returns {string} 基本数据类型：Object | Array | String | Number | Boolean | Null | Undefined
 */
export function typeCheck(checkVar: any): string {
  const typeClass = Object.prototype.toString.call(checkVar)

  return typeClass.split(' ')[1].split(']')[0]
}

/**
 * 判断变量是否为空
 * @param checkVar
 */
export function isEmpty(checkVar: any): boolean {
  let empty = false
  const varType: string = typeCheck(checkVar)

  switch (varType) {
    case 'Number':
    case 'Boolean':
      empty = false
      break
    case 'Null':
    case 'Undefined':
      empty = true
      break
    case 'Array':
    case 'String':
      empty = checkVar.length === 0
      break
    default: {
      const keys = Object.keys(checkVar)
      empty = keys.length === 0
    }
  }

  return empty
}

/**
 *  设置data.a.b.c = value
 *  若data没有a.b 则依次赋值空对象，最后再将a.b.c设为value
 * @param {string} keys a.b.c
 * @param {object} data data.a.b.c
 * @param {unknown} value data.a.b.c = value
 * @param {object} typeMap 确定a.0.b.1中的0和1的父级应该是对象还是数组形式
 * @param parentKey
 */
export const setDeepProp = (
  keys: string[],
  data: Map,
  value: unknown,
  typeMap?: Map,
  parentKey?: Array<string>
): void => {
  if (keys.length === 0) {
    return
  }
  // 取出keys的第一个元素作为当前待填充的key
  const curKey: string = keys.shift() as string
  // data是否有当前key
  if (keys.length > 0) {
    const hasKey = Object.keys(data).includes(curKey)
    if (!hasKey) {
      if (typeMap) {
        const typeKey = Object.keys(typeMap).find((item) => {
          return generateReg(
            parentKey ? parentKey.concat(curKey) : [curKey]
          ).test(item)
        })
        // 根据typeMap判断当前是数组还是对象，兜底逻辑为对象
        if (typeKey) {
          switch (typeMap[typeKey].type) {
            case 'array':
              data[curKey] = []
              break
            case 'object':
              data[curKey] = {}
              break
          }
        } else {
          // TODO @jiangxiaowei 开启需要render函数支持 暂时不支持fieldkey包含.
          // data[curKey] = {}
        }
      } else {
        // typeMap未定义当前curKey时，默认认为是对象
        data[curKey] = {}
      }
    }
    setDeepProp(
      keys,
      data[curKey],
      value,
      typeMap,
      (parentKey || []).concat(curKey)
    )
  } else {
    data[curKey] = value
  }
}

/**
 * 删除data.a.b.c
 * 若data没有a.b.c，则不进行任何操作
 * @param {string} keys [a,b,c]
 * @param {object} data 需要删除的对象
 */
export const deleteDeepProp = (keys: string[], data: Map): void => {
  if (keys.length === 0) return
  // 当前key
  const curKey: string = keys.shift() as string
  // data是否有当前key
  const hasKey = Object.keys(data).includes(curKey)
  if (keys.length > 0) {
    if (!hasKey) {
      return
    }
    deleteDeepProp(keys, data[curKey])
  } else {
    if (Array.isArray(data) && !Number.isNaN(parseInt(curKey))) {
      data.splice(parseInt(curKey), 1)
    } else {
      delete data[curKey]
    }
  }
}

/**
 * 判断对象是否有某一属性，如没有，则根据valueType为其创建
 * 并返回最后一个key的校验生成后的value
 * @param {Map} source 源对象
 * @param {'array' | 'object'} valueType 创建的类型
 * @param {array} keys 对象的key值，支持...以拓展深层对象的创建
 */
export const judgeAndRegister = (
  source: Map,
  valueType: 'array' | 'object',
  ...keys: any[]
): Map => {
  let currSource = source
  for (const key of keys) {
    if (!Object.hasOwnProperty.call(currSource, key)) {
      currSource[key] = valueType === 'array' ? [] : {}
    }
    currSource = currSource[key]
  }
  return currSource
}

/**
 * 允许循环引用的深拷贝
 * @param target
 * @param map
 */
export function deepClone(target: any, map = new WeakMap()): any {
  if (map.get(target) || target === null || target === undefined) return target

  // 针对Date和RegExp等特殊引用类型，直接执行构造函数进行克隆
  const constructor = target.constructor
  if (/^(Date|RegExp)/.test(constructor.name)) {
    return new constructor(target)
  }

  if (typeof target === 'object') {
    // 标记当前target已被处理过，避免递归过程中出现循环引用导致栈溢出的文日
    map.set(target, true)
    const res: any = Array.isArray(target) ? [] : {}
    for (const i in target) {
      if (Object.hasOwnProperty.call(target, i)) {
        res[i] = deepClone(target[i], map)
      }
    }
    return res
  } else {
    return target
  }
}

/**
 * 更新属性，并联动更新与其相关的子元素的对应属性
 * @param items
 * @param fieldKey
 * @param property
 * @param setter
 */
export function setProperty<T extends keyof TreeItem>(
  items: TreeItems,
  fieldKey: string,
  property: T,
  setter: (value: TreeItem[T]) => TreeItem[T]
): TreeItems {
  return items.map((item) => {
    const copiedItem = deepClone(item)
    if (item.fieldKey === fieldKey) {
      copiedItem[property] = setter(copiedItem[property])
      return copiedItem
    }

    if (copiedItem.schema.length) {
      copiedItem.schema = setProperty(
        copiedItem.schema,
        fieldKey,
        property,
        setter
      )
    }

    return copiedItem
  })
}

/**
 * 移除属性，并联动移除与其相关的子元素的对应属性
 * @param schema
 * @param fieldKey
 */
export function removeItem(schema: TreeItems, fieldKey: string): TreeItems {
  return schema.reduce((acc: TreeItems, item) => {
    // 非待删除的数据的id才执行
    if (item.fieldKey !== fieldKey) {
      const copiedItem = deepClone(item)
      if (copiedItem.children.length) {
        copiedItem.children = removeItem(item.schema, fieldKey)
      }
      acc.push(copiedItem)
    }

    return acc
  }, [])
}
/**
 * 该方法用于快速向check的shcmea中注入vcontol。方便过滤已经设置的表单
 * @param obj 待注入vontrol的uiSchema对象
 */
export function injectVcontrol(obj: Record<string, unknown>): void {
  for (const i in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, i)) {
      switch (typeCheck(i)) {
        case 'Array':
          // 数组的vcontrol统一设置在顶层
          break
        case 'Object':
          injectVcontrol(obj[i] as Record<string, unknown>)
          break
        default: {
          // 只有设置了fieldKey的才需要设置vcontrol和vcontrolDefault
          const fieldKey = obj.fieldKey
          if (fieldKey) {
            setDeepProp(
              ['ui', 'vcontrol'],
              obj,
              'return props.formData.viewMode==="configured"?props.get(props.fieldKey).data:true'
            )
          }
          break
        }
      }
    }
  }
}

/**
 * 解析url中?后的参数，返回参数Map
 * @param url
 */
export function parseHrefParam(url: string | undefined): Map {
  url = url || window.location.href
  const parseUrl: string[] | null = /(.*)\?(.*)/.exec(url)
  const res: Map = {}

  if (parseUrl && parseUrl[2]) {
    const paramsList = parseUrl[2].split('&')
    for (const str of paramsList) {
      const split = str.split('=')

      res[split[0]] = split[1] !== undefined ? split[1] : true
    }
  }

  return res
}

export function randomString(length: number): string {
  const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = length; i > 0; --i)
    result += str[Math.floor(Math.random() * str.length)]
  return result
}