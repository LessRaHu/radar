<?php

namespace App\Services;

use App\Exceptions\MediaPathNotSetException;
use App\Exceptions\SongUploadFailedException;
use App\Models\Setting;
use App\Models\Song;
use Illuminate\Http\UploadedFile;

use function Functional\memoize;

class UploadService
{
    private const UPLOAD_DIRECTORY = '__KOEL_UPLOADS__';

    public function __construct(private FileSynchronizer $fileSynchronizer)
    {
    }

    public function handleUploadedFile(UploadedFile $file): Song
    {
        // Genera un nombre de archivo objetivo para el archivo cargado
        $targetFileName = $this->getTargetFileName($file);

        // Mueve el archivo cargado al directorio de carga con el nombre generado
        $file->move($this->getUploadDirectory(), $targetFileName);

        // Obtiene la ruta completa del archivo recién movido
        $targetPathName = $this->getUploadDirectory() . $targetFileName;

        // Sincroniza el archivo utilizando la clase FileSynchronizer
        $result = $this->fileSynchronizer->setFile($targetPathName)->sync();

        // Si hay un error durante la sincronización, elimina el archivo y lanza una excepción
        if ($result->isError()) {
            @unlink($targetPathName); // Elimina el archivo
            throw new SongUploadFailedException($result->error); // Lanza una excepción de carga fallida
        }

        // Si la sincronización fue exitosa, devuelve el objeto Song sincronizado
        return $this->fileSynchronizer->getSong();
    }

    // Método para obtener el directorio de carga
    private function getUploadDirectory(): string
    {
        return memoize(static function (): string {
            $mediaPath = Setting::get('media_path');

            // Verifica si la ruta de medios está configurada
            if (!$mediaPath) {
                throw new MediaPathNotSetException();
            }

            // Devuelve la ruta completa del directorio de carga
            return $mediaPath . DIRECTORY_SEPARATOR . self::UPLOAD_DIRECTORY . DIRECTORY_SEPARATOR;
        });
    }

    // Método para generar un nombre de archivo único
    private function getTargetFileName(UploadedFile $file): string
    {
        // Verifica si existe un archivo con el mismo nombre en el directorio de carga
        if (!file_exists($this->getUploadDirectory() . $file->getClientOriginalName())) {
            return $file->getClientOriginalName(); // Usa el nombre original si no hay conflictos
        }

        // Si hay un conflicto, agrega un hash único al nombre del archivo
        return $this->getUniqueHash() . '_' . $file->getClientOriginalName();
    }

    // Método para generar un hash único
    private function getUniqueHash(): string
    {
        return substr(sha1(uniqid()), 0, 6);
    }
}