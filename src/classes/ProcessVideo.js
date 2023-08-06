const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const { exec, spawn } = require('child_process')

class ProcessVideo extends EventEmitter {
  constructor({
    src,
    dest,
    segment = 5,
    aspectRatio = 16 / 9,
    renditions = [
      { height: 144, bitrate: 200, audiorate: 64 },
      { height: 240, bitrate: 400, audiorate: 64 },
      { height: 360, bitrate: 800, audiorate: 96 },
      { height: 480, bitrate: 1400, audiorate: 128 },
      { height: 720, bitrate: 2800, audiorate: 128 },
      { height: 1080, bitrate: 5000, audiorate: 192 },
    ],
  }) {
    super()
    this.src = src
    this.dest = dest
    this.segment = segment
    this.aspectRatio = aspectRatio
    this.renditions = renditions
    this.resolution = { width: 0, height: 0 }
    this.durations = 0
    this.eligibleRenditions = []
    this.commandArguments = []
  }

  async process() {
    await this.createOutputDirectory()
    await this.fetchVideoResolution()
    await this.fetchVideoDurations()
    await this.calculateEligibleRenditions()
    await this.buildCommandArguments()
    await this.renderVideoWithProgress()
    await this.generateMasterFile()
    this.emit('end')
  }

  async createOutputDirectory() {
    await fs.promises.mkdir(this.dest, { recursive: true })
  }

  async fetchVideoResolution() {
    const result = await this.executeCommand(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ${this.src}`,
    )
    const [width, height] = result.trim().split('x')
    this.resolution = { width: parseInt(width), height: parseInt(height) }
  }

  async fetchVideoDurations() {
    const result = await this.executeCommand(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${this.src}`,
    )
    this.durations = Number(result)
  }

  async calculateEligibleRenditions() {
    for (const rendition of this.renditions) {
      const { height } = rendition
      const width = height * this.aspectRatio

      if (this.resolution.width >= width && this.resolution.height >= height) {
        this.eligibleRenditions.push(rendition)
      }
    }
  }

  async generateMasterFile() {
    let masterPlaylist = `#EXTM3U\n#EXT-X-VERSION:3\n`
    for (const rendition of this.eligibleRenditions) {
      const { height, bitrate } = rendition
      masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bitrate * 1000},RESOLUTION=${height}\n${height}p.m3u8\n`
    }
    await fs.promises.writeFile(path.join(this.dest, 'playlist.m3u8'), masterPlaylist)
  }

  async buildCommandArguments() {
    const staticParams = [
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-c:v',
      'h264',
      '-profile:v',
      'main',
      '-crf',
      '20',
      '-sc_threshold',
      '0',
    ]
    const staticParamsSuffix = ['-hls_time', this.segment, '-hls_playlist_type', 'vod']

    const miscParams = ['-hide_banner', '-y']

    this.commandArguments = []
    for (const rendition of this.eligibleRenditions) {
      const { height, bitrate, audiorate } = rendition
      const width = height * this.aspectRatio
      const maxRate = parseInt(bitrate * 1.07)
      const bufferSize = parseInt(bitrate * 1.5)

      this.commandArguments = [
        ...this.commandArguments,
        ...staticParams,
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
        '-b:v',
        `${bitrate}k`,
        '-maxrate',
        `${maxRate}k`,
        '-bufsize',
        `${bufferSize}k`,
        '-b:a',
        `${audiorate}k`,
        ...staticParamsSuffix,
        '-hls_segment_filename',
        `${this.dest}/${height}p_%03d.ts`,
        `${this.dest}/${height}p.m3u8`,
      ]
    }

    this.commandArguments = [...miscParams, '-i', this.src, ...this.commandArguments]
  }
  async renderVideoWithProgress() {
    return new Promise((resolve, reject) => {
      const childProcess = spawn('ffmpeg', this.commandArguments)

      let duration = 0
      let progress = 0

      childProcess.stderr.on('data', (data) => {
        const output = data.toString()
        const durationMatch = output.match(/Duration: (\d\d:\d\d:\d\d.\d\d)/)

        if (durationMatch) {
          const [_, durationStr] = durationMatch
          const [hours, minutes, seconds] = durationStr.split(':').map(parseFloat)
          duration = hours * 3600 + minutes * 60 + seconds
        }

        const timeMatch = output.match(/time=(\d\d:\d\d:\d\d.\d\d)/)

        if (timeMatch) {
          const [_, currentTimeStr] = timeMatch
          const [hours, minutes, seconds] = currentTimeStr.split(':').map(parseFloat)
          const currentTime = hours * 3600 + minutes * 60 + seconds
          const percentage = Math.min(Math.floor((currentTime / duration) * 100), 100)

          if (percentage !== progress) {
            progress = percentage
            this.emit('progress', { progress })
          }
        }
      })

      childProcess.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          const err = new Error(`Error converting video: Child process exited with code ${code}`)
          this.emit('error', err)
          reject(err)
        }
      })

      childProcess.on('error', (err) => {
        this.emit('error', err)
        reject(err)
      })
    })
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message))
        } else {
          resolve(stdout.trim())
        }
      })
    })
  }
}

module.exports = ProcessVideo
