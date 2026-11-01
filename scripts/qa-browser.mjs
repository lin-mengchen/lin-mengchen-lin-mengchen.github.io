import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const browserCandidates = [
  process.env.BROWSER_EXECUTABLE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const executablePath = browserCandidates.find((candidate) => existsSync(candidate))
if (!executablePath) {
  throw new Error('未找到 Chrome 或 Edge；可通过 BROWSER_EXECUTABLE_PATH 指定浏览器。')
}

mkdirSync('qa', { recursive: true })

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
  ],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const messages = []
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    messages.push({ type: message.type(), text: message.text() })
  }
})
page.on('pageerror', (error) => messages.push({ type: 'pageerror', text: error.message }))

await page.goto(process.env.QA_BASE_URL ?? 'http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
await page.getByText('入衣字符').waitFor({ state: 'visible', timeout: 15_000 })
await page.screenshot({ path: 'qa/initial.png', fullPage: true })

const metrics = await page.locator('.metric-grid dd').allTextContents()
const warningText = await page.locator('.validation-warning').allTextContents()
const canvasCount = await page.locator('canvas').count()
const progressInput = page.getByLabel('动画进度')

await page.getByRole('button', { name: '生成诗衣' }).click()
await page.waitForTimeout(2_700)
const motionProgress = Number(await progressInput.inputValue())
if (motionProgress < 170 || motionProgress > 300) {
  throw new Error(`动画时钟进度异常：${motionProgress}`)
}

await page.getByRole('button', { name: '暂停' }).click()
const pausedProgress = Number(await progressInput.inputValue())
await page.waitForTimeout(350)
if (Number(await progressInput.inputValue()) !== pausedProgress) {
  throw new Error('暂停后进度仍在变化。')
}

await page.getByLabel('从头重播十二秒动画').click()
await page.waitForTimeout(120)
const replayProgress = Number(await progressInput.inputValue())
if (replayProgress > 30) {
  throw new Error(`重播未回到开头：${replayProgress}`)
}

await progressInput.fill('1000')
await page.waitForTimeout(750)
await page.getByLabel('重置三维视角').click()
await page.waitForTimeout(300)
await page.screenshot({ path: 'qa/final.png', fullPage: true })

const canvas = page.locator('canvas')
const canvasBox = await canvas.boundingBox()
if (!canvasBox) throw new Error('无法取得三维画布边界。')
await page.mouse.move(
  canvasBox.x + canvasBox.width * 0.55,
  canvasBox.y + canvasBox.height * 0.5,
)
await page.mouse.down()
await page.mouse.move(
  canvasBox.x + canvasBox.width * 0.68,
  canvasBox.y + canvasBox.height * 0.46,
  { steps: 12 },
)
await page.mouse.up()
await page.waitForTimeout(500)
await page.screenshot({ path: 'qa/three-quarter.png', fullPage: true })

const result = {
  title: await page.title(),
  metrics,
  warningText,
  canvasCount,
  playbackCheck: { motionProgress, pausedProgress, replayProgress },
  status: await page.locator('.status-chip').innerText(),
  consoleMessages: messages,
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
await browser.close()
