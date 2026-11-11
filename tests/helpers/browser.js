// Opens Chrome with Selenium WebDriver.
// The Chrome window is shown, so you can watch the tests click through
// the website. Set HEADLESS=1 to run without a window.

const fs = require("fs");
const path = require("path");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { ROOT, SITE } = require("./common");

const SHOTS = path.join(ROOT, "test-report", "screenshots");

function localDriver() {
    const names = {
        "darwin-arm64": "chromedriver-mac-arm64",
        "darwin-x64": "chromedriver-mac-x64",
        "win32-x64": "chromedriver-win64.exe",
        "linux-x64": "chromedriver-linux64"
    };
    const name = names[process.platform + "-" + process.arch];
    const file = name && path.join(ROOT, "tests", "drivers", name);
    if (!file || !fs.existsSync(file)) return null;
    try { fs.chmodSync(file, 0o755); } catch (e) { /* already runnable */ }
    return file;
}

async function openBrowser() {
    const options = new chrome.Options();
    if (process.env.HEADLESS === "1" || process.env.CI) options.addArguments("--headless=new");
    options.addArguments("--window-size=1366,900", "--no-sandbox", "--disable-dev-shm-usage");
    // No "save password?" pop-ups during the tests
    options.setUserPreferences({ credentials_enable_service: false, "profile.password_manager_enabled": false });

    const builder = new Builder().forBrowser("chrome").setChromeOptions(options);

    // ChromeDriver (the helper that lets Selenium control Chrome):
    // 1. CHROMEDRIVER_PATH if set, 2. one saved in tests/drivers (works
    // without internet), 3. otherwise Selenium downloads one by itself.
    const driverPath = process.env.CHROMEDRIVER_PATH || localDriver();
    if (driverPath) {
        builder.setChromeService(new chrome.ServiceBuilder(driverPath).addArguments("--disable-build-check"));
    }
    return builder.build();
}

// Small helpers so the tests read like steps
function helpers(driver) {
    const h = {
        go: (page) => driver.get(SITE + "/" + page),
        el: (css, timeout = 10000) => driver.wait(until.elementLocated(By.css(css)), timeout),
        all: (css) => driver.findElements(By.css(css)),
        async visible(css, timeout = 10000) {
            const e = await h.el(css, timeout);
            await driver.wait(until.elementIsVisible(e), timeout);
            return e;
        },
        async type(css, text) {
            const e = await h.visible(css);
            await e.clear();
            await e.sendKeys(text);
        },
        async click(css) {
            const e = await h.visible(css);
            await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", e);
            await e.click();
        },
        async select(css, visibleText) {
            const e = await h.visible(css);
            await driver.executeScript(
                "const s=arguments[0];const o=[...s.options].find(x=>x.text.trim()===arguments[1]||x.value===arguments[1]);" +
                "if(!o)throw new Error('No option '+arguments[1]);s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));s.dispatchEvent(new Event('input',{bubbles:true}));",
                e, visibleText);
        },
        async setValue(css, value) {
            const e = await h.el(css);
            await driver.executeScript(
                "arguments[0].value=arguments[1];arguments[0].dispatchEvent(new Event('input',{bubbles:true}));arguments[0].dispatchEvent(new Event('change',{bubbles:true}));",
                e, value);
        },
        text: async (css) => (await (await h.el(css)).getText()).trim(),
        page: async () => (await driver.getCurrentUrl()).split("?")[0].split("/").pop(),
        waitForPage: (name, timeout = 15000) =>
            driver.wait(async () => (await h.page()) === name, timeout, "Expected to reach " + name),
        waitForText: (css, regex, timeout = 10000) =>
            driver.wait(async () => regex.test(await (await h.el(css)).getText()), timeout, "Expected " + css + " to show " + regex),
        // Accept a pop-up (alert / confirm) and return its text
        async acceptAlert(timeout = 10000) {
            await driver.wait(until.alertIsPresent(), timeout);
            const alert = await driver.switchTo().alert();
            const message = await alert.getText();
            await alert.accept();
            return message;
        },
        async screenshot(name) {
            fs.mkdirSync(SHOTS, { recursive: true });
            fs.writeFileSync(path.join(SHOTS, name + ".png"), await driver.takeScreenshot(), "base64");
        },
        async logOut() {
            await driver.executeScript("localStorage.removeItem('bookNMeetCurrentUser');localStorage.removeItem('bookNMeetSession');");
        }
    };
    return h;
}

module.exports = { openBrowser, helpers, By, until };
