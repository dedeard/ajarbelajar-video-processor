const fs = require('fs')
const path = require('path')
const minio = require('minio')
const config = require('../config/config')
const fsp = fs.promises

const minioClient = new minio.Client(config.minio.config)

/**
 * Utility class for interacting with MinIO object storage.
 */
class Storage {
  /**
   * Downloads a file from the MinIO bucket to a local file path.
   *
   * @param {string} objectName - The name of the file in the bucket.
   * @param {string} filePath - The local file path to save the downloaded file.
   * @returns {Promise<string>} The local file path where the file is saved.
   */
  static async downloadFile(objectName, filePath) {
    const dataStream = await minioClient.getObject(config.minio.bucket, objectName)
    const fileStream = fs.createWriteStream(filePath)

    return new Promise((resolve, reject) => {
      dataStream.on('data', (chunk) => fileStream.write(chunk))
      dataStream.on('end', () => {
        fileStream.end()
        resolve(filePath)
      })
      dataStream.on('error', (err) => {
        fileStream.end()
        reject(err)
      })
    })
  }

  /**
   * Uploads a directory and its contents to the MinIO bucket.
   *
   * @param {string} directoryPath - The local path of the directory to upload.
   * @param {string} [destination=''] - The optional destination path in the bucket.
   */
  static async uploadDirectory(directoryPath, destination = '') {
    const files = await fsp.readdir(directoryPath)

    for (const file of files) {
      const filePath = path.join(directoryPath, file)
      const stats = await fsp.stat(filePath)

      if (stats.isDirectory()) {
        const subDestination = path.join(destination, file)
        await Storage.uploadDirectory(config.minio.bucket, filePath, subDestination)
      } else {
        const objectName = path.join(destination, file)
        await minioClient.fPutObject(config.minio.bucket, objectName, filePath)
      }
    }
  }

  /**
   * Deletes a file from the MinIO bucket.
   *
   * @param {string} objectName - The name of the file to delete in the bucket.
   */
  static async deleteFile(objectName) {
    await minioClient.removeObject(config.minio.bucket, objectName)
  }
}

module.exports = Storage
