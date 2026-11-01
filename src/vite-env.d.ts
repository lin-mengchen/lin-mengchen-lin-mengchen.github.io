/// <reference types="vite/client" />

declare module '*.xlsx?url' {
  const url: string
  export default url
}

declare module '*.xls?url' {
  const url: string
  export default url
}
