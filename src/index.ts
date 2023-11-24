import 'dotenv/config'
import { Client, EmbedBuilder } from 'discord.js'
import puppeteer, { ElementHandle } from 'puppeteer'
import { generateBrowserSettings } from './puppeteer/browserSettings'

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'GuildMembers', 'MessageContent'],
})

client.on('ready', (c) => {
  console.log(`${c.user.username} is online.`)
})

client.on('messageCreate', async (message) => {
  if (message.author.bot) return

  const twitterUrlRegex =
    /https?:\/\/twitter\.com\/([a-zA-Z0-9_]{1,15})\/status\/\d+/
  const xUrlRegex = /https?:\/\/x\.com\/([a-zA-Z0-9_]{1,15})\/status\/\d+/

  const urlMatches = message.content.match(twitterUrlRegex)
  const urlMatchesX = message.content.match(xUrlRegex)
  let url = null
  let user = null

  if (urlMatches) {
    url = urlMatches[0]
    user = 'https://twitter.com/' + urlMatches[1]
  } else if (urlMatchesX) {
    url = urlMatchesX[0]
    user = 'https://x.com/' + urlMatchesX[1]
  }

  if (url !== null) {
    try {
      const browser = await puppeteer.launch({
        args: generateBrowserSettings(),
      })

      const page = await browser.newPage()
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'dark' },
      ])

      await page.setViewport({
        width: 1440,
        height: 900,
      })

      await page.goto(url as string, { waitUntil: 'networkidle2' })

      const extractedText = await page.$eval(
        '*',
        (el) => (el as HTMLElement).innerText
      )
      let arrayText = extractedText.split('\n')
      let name = arrayText[4]
      let handle = arrayText[5]
      let tweet = ''
      let tweetIndex = 0
      let timeIndex = 0
      let time = null
      let likesIndex = 0
      let likes = null
      let rtIndex = 0
      let retweet = null
      let tweetStart = 6
      let imgIndex = 2
      let avatarUrl = null
      let screenshotBuffer = null
      for (let i = tweetStart; i < arrayText.length; i++) {
        if (arrayText[i] == '·' && arrayText[i + 2] == ' Views') {
          tweetIndex = i - 2
          timeIndex = i - 1
          likesIndex = i + 7
          rtIndex = i + 3
          break
        } else if (arrayText[i] == ' Views') {
          tweetStart = 10
          name = arrayText[8]
          handle = arrayText[9]
          tweetIndex = i - 4
          timeIndex = i - 3
          likesIndex = i + 5
          rtIndex = i + 1
          imgIndex = 4
          break
        }
      }
      time = arrayText[timeIndex]
      likes = arrayText[likesIndex]
      retweet = arrayText[rtIndex]
      for (let i = tweetStart; i < tweetIndex + 1; i++) {
        tweet = tweet.concat(arrayText[i])
        tweet = tweet.concat('\n')
      }
      if (!tweet || tweet.trim().length === 0) {
        tweet = 'Content not available'
      }
      const articleElement = await page.$('article')

      if (articleElement) {
        const avatarPromise = page.$x('(//article//img)[1]').then((avatars) => {
          if (avatars.length > 0) {
            const avatar = avatars[0] as ElementHandle<Element>
            return avatar.evaluate((el) => el.getAttribute('src'))
          }
          return null
        })

        const screenshotPromise = page
          .$x(`(//article//img)[${imgIndex}]`)
          .then((elements) => {
            const imgElement = elements[0]
            return imgElement ? imgElement.screenshot() : null
          })

        const results = await Promise.allSettled([
          avatarPromise,
          screenshotPromise,
        ])

        const avatarResult = results[0]
        const screenshotResult = results[1]

        avatarUrl =
          avatarResult.status === 'fulfilled' ? avatarResult.value : null
        screenshotBuffer =
          screenshotResult.status === 'fulfilled'
            ? screenshotResult.value
            : null
      } else {
        console.log('Article tag not found')
      }

      const embed = new EmbedBuilder()
        .setAuthor({
          name: name + ' (' + handle + ')',
          iconURL: avatarUrl!,
          url: user!,
        })
        .setDescription(tweet)
        .setImage('attachment://screenshot.png')
        .setFooter({ text: 'Twitter • ' + time })
        .addFields(
          { name: 'Likes', value: likes, inline: true },
          { name: 'Retweets', value: retweet, inline: true }
        )

      if (screenshotBuffer !== null) {
        await message.reply({
          embeds: [embed],
          files: [{ attachment: screenshotBuffer, name: 'screenshot.png' }],
        })
      } else {
        await message.reply({
          embeds: [embed],
        })
      }

      await browser.close()
    } catch (error) {
      console.error('Error taking screenshot:', error)
    }
  }
})

client.login(process.env.TOKEN)
