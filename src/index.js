const redis = require('ioredis')
const Noderavel = require('./classes/NodeLaravel')
const config = require('./config/config')
const logger = require('./config/logger')
const ProcessVideo = require('./classes/ProcessVideo')
const Storage = require('./classes/Storage')
const FileSystem = require('./classes/FileSystem')

const redisClient = redis.createClient(config.redis)

// Define a class for the EpisodeUpdatedJob
class EpisodeUpdatedJob {
  constructor(episodeId, data) {
    this.episodeId = episodeId
    this.data = data
  }
}

// Define a class for the EpisodeProcessJob
class EpisodeProcessJob {
  constructor(episode) {
    this.episode = episode
  }

  // Method to be called when the job is processed
  async onJob() {
    // Create a Noderavel instance to push update job to the queue
    const updateEpisodeJob = new Noderavel({
      client: redisClient,
      scope: {
        'App\\Jobs\\EpisodeUpdatedJob': EpisodeUpdatedJob,
      },
      queue: 'ajarbelajar_database_queues:default',
    })

    // Push the EpisodeUpdatedJob to indicate the episode is processing
    await updateEpisodeJob.push(
      'App\\Jobs\\EpisodeUpdatedJob',
      new EpisodeUpdatedJob(this.episode.id, { status: 'processing' }),
    )

    try {
      // Create a directory to store processed videos
      await FileSystem.createDir('videos/' + this.episode.name)

      // Download the video file from the 'episodes' storage to the 'videos' folder
      const videoSrc = await Storage.downloadFile(
        'episodes/' + this.episode.name,
        'videos/' + this.episode.name + '/tmp',
      )

      // Process the video, including encoding and resizing
      const video = new ProcessVideo({
        src: videoSrc,
        dest: 'videos/' + this.episode.name,
      })
      await video.process()

      // Remove the temporary video file
      await FileSystem.remove(videoSrc)

      // Delete the original video file from 'episodes' storage
      await Storage.deleteFile('episodes/' + this.episode.name)

      // Upload the processed videos to the 'videos' storage
      await Storage.uploadDirectory('videos/' + this.episode.name, 'episodes/' + this.episode.name)

      // Remove the temporary folder used for processing
      await FileSystem.remove('videos/' + this.episode.name)

      // Push the EpisodeUpdatedJob to indicate the episode processing is successful
      await updateEpisodeJob.push(
        'App\\Jobs\\EpisodeUpdatedJob',
        new EpisodeUpdatedJob(this.episode.id, { status: 'success', seconds: video.durations }),
      )
    } catch (e) {
      // Catch and log any errors that occur during processing
      logger.error(e)

      // Push the EpisodeUpdatedJob to indicate the episode processing failed
      await updateEpisodeJob.push(
        'App\\Jobs\\EpisodeUpdatedJob',
        new EpisodeUpdatedJob(this.episode.id, { status: 'failed' }),
      )
    }
  }
}

// Main function to start the queue worker
async function main() {
  // Create a Noderavel instance to listen for EpisodeProcessJob
  let queueWorker = new Noderavel({
    client: redisClient,
    scope: {
      'App\\Jobs\\EpisodeProcessJob': EpisodeProcessJob,
    },
    queue: 'ajarbelajar_database_queues:episode',
  })

  // Start listening for EpisodeProcessJob
  queueWorker.listen()
}

// Call the main function to start the queue worker
main()
