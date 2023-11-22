import 'dotenv/config'
import { Client } from 'discord.js'
import puppeteer, { ElementHandle } from 'puppeteer'
import { generateBrowserSettings } from './puppeteer/browserSettings'
import { EmbedBuilder } from 'discord.js'

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
      let avatarUrl = null
      await page.goto(url as string, { waitUntil: 'networkidle2' })
      await page.evaluate(() => {
        let element = document.body
        for (let i = 0; i < 6; i++) {
          if (element && element.querySelector('div')) {
            element = element.querySelector('div')!
          } else {
            return
          }
        }
        if (element) {
          element.style.display = 'none'
        }
      })

      const extractedText = await page.$eval(
        '*',
        (el) => (el as HTMLElement).innerText
      )

      console.log(extractedText)
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
      for (let i = 6; i < arrayText.length; i++) {
        if (arrayText[i] == '·' && arrayText[i + 2] == ' Views') {
          tweetIndex = i - 2
          timeIndex = i - 1
          likesIndex = i + 7
          rtIndex = i + 3
          break
        }
      }
      time = arrayText[timeIndex]
      likes = arrayText[likesIndex]
      retweet = arrayText[rtIndex]
      for (let i = 6; i < tweetIndex + 1; i++) {
        tweet = tweet.concat(arrayText[i])
        tweet = tweet.concat('\n')
      }

      let screenshotBuffer = null
      const articleElement = await page.$('article')
      if (articleElement) {
        const avatars = (await page.$x(
          '(//article//img)[1]'
        )) as ElementHandle<Element>[]

        const [imgElement] = await page.$x('(//article//img)[2]')
        if (imgElement) {
          screenshotBuffer = await imgElement.screenshot()
        } else {
          console.log('No img tag found within the article')
        }
        if (avatars.length > 0) {
          const avatar: ElementHandle<Element> = avatars[0]
          const imgSrc: string | null = await avatar.evaluate((el) =>
            el.getAttribute('src')
          )
          avatarUrl = imgSrc
          console.log(imgSrc)
        } else {
          console.log('No img tag found within the article')
        }
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
      url = null
    } catch (error) {
      console.error('Error taking screenshot:', error)
    }
  }
})
client.login(process.env.TOKEN)
