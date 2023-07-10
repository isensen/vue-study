// 该常量用于 Vue 服务端渲染时，将 data-server-rendered 属性添加到生成的 HTML 标记中。
// 这个属性用于标识该 HTML 标记是由服务端渲染生成的，而不是客户端渲染生成的。
// 在服务端渲染完成后，客户端渲染会接管页面并重新渲染，此时客户端会将该属性从标记中删除，以避免对后续交互产生影响。
export const SSR_ATTR = 'data-server-rendered'

// as const 使 ASSET_TYPES是readonly, 是不能修改的, 如 ASSET_TYPES[0] = '1';
export const ASSET_TYPES = ['component', 'directive', 'filter'] as const

export const LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated',
  'errorCaptured',
  'serverPrefetch',
  'renderTracked',
  'renderTriggered'
] as const
