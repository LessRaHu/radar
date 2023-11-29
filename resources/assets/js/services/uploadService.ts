import { without } from 'lodash'
import { reactive } from 'vue'
import { http } from '@/services'
import { albumStore, overviewStore, songStore } from '@/stores'
import { logger } from '@/utils'

interface UploadResult {
  song: Song
  album: Album
}

export type UploadStatus =
  | 'Ready'
  | 'Uploading'
  | 'Uploaded'
  | 'Canceled'
  | 'Errored'

export interface UploadFile {
  id: string
  file: File
  status: UploadStatus
  name: string
  progress: number
  message?: string
}

export const uploadService = {
  state: reactive({
    files: [] as UploadFile[]
  }),

  simultaneousUploads: 5,

  queue (file: UploadFile | UploadFile[]) {
    this.state.files = this.state.files.concat(file)
    this.proceed()
  },

  remove (file: UploadFile) {
    this.state.files = without(this.state.files, file)
    this.proceed()
  },

  proceed () {
    const remainingSlots = this.simultaneousUploads - this.getUploadingFiles().length

    if (remainingSlots <= 0) {
      return
    }

    for (let i = 0; i < remainingSlots; ++i) {
      const file = this.getUploadCandidate()
      file && this.upload(file)
    }
  },

  getUploadingFiles () {
    return this.state.files.filter(file => file.status === 'Uploading')
  },

  getUploadCandidate () {
    return this.state.files.find(file => file.status === 'Ready')
  },

  shouldWarnUponWindowUnload () {
    return this.state.files.length > 0
  },

  async upload(file: UploadFile) {
    if (file.status === 'Uploading') {
      return
    }
  
    // Crea un objeto FormData para enviar el archivo al servidor
    const formData = new FormData()
    formData.append('file', file.file) // Adjunta el archivo al objeto FormData
    file.progress = 0 // Establece el progreso de la subida en 0
    file.status = 'Uploading' // Establece el estado del archivo como 'Uploading'
  
    try {
      // Realiza una solicitud HTTP POST al servidor para subir el archivo
      const result = await http.post<UploadResult>('upload', formData, (progressEvent: ProgressEvent) => {
        // Actualiza el progreso de la subida en función del evento de progreso
        file.progress = progressEvent.loaded * 100 / progressEvent.total
      })
  
      // Si la subida es exitosa, actualiza el estado del archivo a 'Uploaded'
      file.status = 'Uploaded'
  
      // Realiza operaciones relacionadas con la respuesta de la subida exitosa
      // Por ejemplo, sincronización de datos en las tiendas de canciones y álbumes, y actualización de la vista general
      songStore.syncWithVault(result.song)
      albumStore.syncWithVault(result.album)
      overviewStore.refresh()
  
      // Procede a subir el siguiente archivo en la cola después de un tiempo de espera
      this.proceed()
      window.setTimeout(() => this.remove(file), 1000)
    } catch (error: any) {
      // En caso de error en la subida, registra el error y actualiza el estado del archivo a 'Errored'
      logger.error(error)
      file.message = `Upload failed: ${error.response?.data?.message || 'Unknown error'}`
      file.status = 'Errored'
  
      // Procede a subir el siguiente archivo en la cola después de un error
      this.proceed()
    }
  },
  

  retry (file: UploadFile) {
    // simply reset the status and wait for the next process
    this.resetFile(file)
    this.proceed()
  },

  retryAll () {
    this.state.files.forEach(this.resetFile)
    this.proceed()
  },

  resetFile: (file: UploadFile) => {
    file.status = 'Ready'
    file.progress = 0
  },

  removeFailed () {
    this.state.files = this.state.files.filter(file => file.status !== 'Errored')
  }
}
