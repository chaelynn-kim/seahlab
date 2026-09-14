import { removeKey, readJson, writeJson } from './storage'

const STAMP_KEY = 'approvalStamp'
const MAX_WIDTH = 360
const MAX_HEIGHT = 160
const MAX_FILE_BYTES = 8 * 1024 * 1024

export function loadApprovalStamp(): string | null {
  const saved = readJson<string | null>(STAMP_KEY, null)
  if (typeof saved === 'string' && saved.startsWith('data:image/')) return saved
  return null
}

export function saveApprovalStamp(value: string | null): string | null {
  if (!value) {
    removeKey(STAMP_KEY)
    return null
  }
  writeJson(STAMP_KEY, value)
  return value
}

export function compressStampImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('이미지 파일만 첨부할 수 있습니다.'))
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error('이미지 용량이 너무 큽니다. 8MB 이하로 첨부해 주세요.'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('이미지를 열지 못했습니다.'))
      image.onload = () => {
        const scale = Math.min(MAX_WIDTH / image.width, MAX_HEIGHT / image.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('이미지를 처리하지 못했습니다.'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
