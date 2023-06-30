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
