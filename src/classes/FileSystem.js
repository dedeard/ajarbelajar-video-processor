const fs = require('fs').promises
const path = require('path')

class FileSystem {
  /**
   * Creates a directory at the specified path.
   *
   * @param {string} directory - The path of the directory to create.
   * @returns {Promise<void>} A promise that resolves when the directory is created successfully.
   */
  static async createDir(directory) {
    try {
      await fs.mkdir(directory, { recursive: true })
    } catch (err) {
      throw err
    }
  }

  /**
   * Removes a file or directory at the specified path.
   *
   * @param {string} path - The path of the file or directory to remove.
   * @returns {Promise<void>} A promise that resolves when the file/directory is removed successfully.
   */
  static async remove(path) {
    try {
      const stats = await fs.stat(path)

      if (stats.isDirectory()) {
        await FileSystem.removeDirectory(path)
      } else {
        await fs.unlink(path)
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * Helper function to remove a directory and its contents recursively.
   *
   * @param {string} directory - The path of the directory to remove.
   * @returns {Promise<void>} A promise that resolves when the directory is removed successfully.
   */
  static async removeDirectory(directory) {
    const files = await fs.readdir(directory)

    for (const file of files) {
      const filePath = path.join(directory, file)
      const stats = await fs.stat(filePath)

      if (stats.isDirectory()) {
        await FileSystem.removeDirectory(filePath)
      } else {
        await fs.unlink(filePath)
      }
    }

    await fs.rmdir(directory)
  }
}

module.exports = FileSystem
