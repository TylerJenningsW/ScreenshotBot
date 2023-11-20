import 'dotenv/config'
import { Client } from 'discord.js'
import puppeteer from 'puppeteer'
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
    /https?:\/\/twitter\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+/
  const xUrlRegex = /https?:\/\/x\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+/
  
  const urlMatches = message.content.match(twitterUrlRegex)
  const urlMatchesX = message.content.match(xUrlRegex)
  let url = null
  if (urlMatches) {
    url = urlMatches[0]
  } else if (urlMatchesX) {
    url = urlMatchesX[0]
  }
  if (url !== null) {
    try {
      const browser = await puppeteer.launch({
        args: generateBrowserSettings(),
      })

      const page = await browser.newPage()
      await page.goto(url as string, { waitUntil: 'networkidle2' })

      const screenshotBuffer = await page.screenshot()
      await message.reply({
        files: [{ attachment: screenshotBuffer, name: 'screenshot.png' }],
      })

      await browser.close()
      url = null
    } catch (error) {
      console.error('Error taking screenshot:', error)
    }
  }
})
client.login(process.env.TOKEN)
