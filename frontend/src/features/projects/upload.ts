const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const supportedExtension = /\.(pdf|png|jpe?g|webp)$/i

export const uploadAccept = `${supportedTypes.join(',')},.pdf,.png,.jpg,.jpeg,.webp`

export function validateUpload(file: Pick<File, 'name' | 'type' | 'size'>) {
  if (!supportedTypes.includes(file.type) && !supportedExtension.test(file.name)) {
    throw new Error('Choose a PDF, PNG, JPEG or WebP file.')
  }
  if (file.size > 250 * 1024 * 1024) throw new Error('Choose a PDF or image smaller than 250 MB.')
}
