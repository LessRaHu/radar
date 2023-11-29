import { cache, http } from '@/services'
import { albumStore, artistStore, songStore } from '@/stores'

export const mediaInfoService = {
  // Método para obtener información adicional de un artista
  async fetchForArtist(artist: Artist) {
    // Actualiza los datos del artista desde el almacenamiento local si es necesario
    artist = artistStore.syncWithVault(artist)[0]

    // Se crea una clave para la caché usando el ID del artista
    const cacheKey = ['artist.info', artist.id]

    // Si la información del artista está en caché, se devuelve desde la caché
    if (cache.has(cacheKey)) return cache.get<ArtistInfo>(cacheKey)

    // Obtener información adicional del servidor a través de una solicitud HTTP
    const info = await http.get<ArtistInfo | null>(`artists/${artist.id}/information`)

    // Si se obtuvo información, se guarda en caché
    info && cache.set(cacheKey, info)

    // Si hay una imagen en la información obtenida, se actualiza la imagen del artista
    info?.image && (artist.image = info.image)

    // Devuelve la información obtenida
    return info
  },

  // Método para obtener información adicional de un álbum
  async fetchForAlbum(album: Album) {
    // Actualiza los datos del álbum desde el almacenamiento local si es necesario
    album = albumStore.syncWithVault(album)[0]

    // Se crea una clave para la caché usando el ID del álbum
    const cacheKey = ['album.info', album.id]

    // Si la información del álbum está en caché, se devuelve desde la caché
    if (cache.has(cacheKey)) return cache.get<AlbumInfo>(cacheKey)

    // Obtener información adicional del servidor a través de una solicitud HTTP
    const info = await http.get<AlbumInfo | null>(`albums/${album.id}/information`)

    // Si se obtuvo información, se guarda en caché
    info && cache.set(cacheKey, info)

    // Si hay una portada de álbum en la información obtenida, se actualiza la portada del álbum
    if (info?.cover) {
      album.cover = info.cover
      // Actualiza la portada de cada canción en el álbum
      songStore.byAlbum(album).forEach(song => (song.album_cover = info.cover!))
    }

    // Devuelve la información obtenida
    return info
  }
}
