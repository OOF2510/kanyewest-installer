const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const url = require("url");
const fs = require("fs");
const fetch = require("node-fetch");
const extract = require("extract-zip");
const ProgressBar = require("electron-progressbar");
const fse = require("fs-extra");
const releases = require("electron-releases");
const AdmZip = require("adm-zip");

let folderPath = "C:/Windows/tracing/KanyeWest";
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 360,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "index.html"),
      protocol: "file:",
      slashes: true,
    })
  );

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  if (mainWindow === null) createWindow();
});

ipcMain.on("startInstallation", async (event, data) => {
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "console.html"),
      protocol: "file:",
      slashes: true,
    })
  );

  const selectedApps = data;
  mainWindow.webContents.send(
    "installation-status",
    `Apps to install: ${selectedApps.join(", ")}`
  );

  try {
    await createFolder(folderPath);
    await executeCommand(`icacls ${folderPath} /grant Users:(OI)(CI)(F) /T`);

    for (const app of selectedApps) {
      await installApp(app, folderPath);
    }
  } catch (error) {
    console.error(`Error during installation: ${error}`);
  }
});

function createFolder(folderPath) {
  return new Promise((resolve, reject) => {
    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) {
        reject(`Error creating folder: ${err}`);
      } else {
        resolve(`Folder created successfully: ${folderPath}`);
      }
    });
  });
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error: ${error}`);
      } else {
        resolve(`Command executed successfully: ${stdout}`);
      }
    });
  });
}

function extractZip(outputPath, appFolder) {
  return new Promise((resolve, reject) => {
    extract(outputPath, { dir: appFolder }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function getAppExe(app) {
  switch (app) {
    case "5d_chess":
      return "5dchesswithmultiversetimetravel.exe";
    case "7zip":
      return "7-ZipPortable.exe";
    case "2048":
      return "2048Portable.exe";
    case "assault_cube":
      return "AssaultCubePortable.exe";
    case "dolphin":
      return "Dolphin.exe";
    case "dosbox":
      return "DOSBoxPortable.exe";
    case "epic":
      return "rare.exe";
    case "funny_truck":
      return "Funny Truck.exe";
    case "krita":
      return "bin/krita.exe";
    case "obs":
      return "bin/64bit/obs64.exe";
    case "openttd":
      return "OpenTTDPortable.exe";
    case "pcsx2":
      return "pcsx2-qt.exe";
    case "people_playground":
      return "People Playground.exe";
    case "python":
      return "python.exe";
    case "retroarch":
      return "retroarch.exe";
    case "super_tux_kart":
      return "SuperTuxKartPortable.exe";
    case "super_tux":
      return "SuperTuxPortable.exe";
    case "ultrasurf":
      return "ultrasurf.exe";
    default:
      return "";
  }
}

function createDesktopShortcut(appFolder, exe, appName) {
  const desktopPath = app.getPath("desktop");
  const shortcutPath = path.join(desktopPath, `${appName}.lnk`);
  const targetPath = path.join(appFolder, exe);

  releases.createShortcut(targetPath, shortcutPath, (err) => {
    if (err) {
      console.error(`Error creating desktop shortcut: ${err}`);
    } else {
      mainWindow.webContents.send(
        "installation-status",
        `Desktop shortcut for ${appName} created at ${shortcutPath}`
      );
    }
  });
}

async function installApp(app, folderPath) {
  const appUrl = `https://kanyewestappdl.netlify.app/${app}.zip`;
  const appFolder = path.join(folderPath, app);
  const progressBar = new ProgressBar({
    indeterminate: false,
    text: `Downloading ${app}`,
    detail: "0%",
    browserWindow: {
      webPreferences: {
        nodeIntegration: true,
      },
      parent: mainWindow,
    },
  });

  try {
    const response = await fetch(appUrl);
    if (!response.ok) {
      progressBar.setCompleted();
      mainWindow.webContents.send(
        "installation-status",
        `Error downloading ${app}: ${error}`
      );
      return;
    }

    const contentLength = response.headers.get("content-length");
    const outputPath = path.join(appFolder, `${app}.zip`);
    const fileStream = fs.createWriteStream(outputPath);

    // Initialize receivedBytes to 0
    let receivedBytes = 0;

    response.body
      .on("data", (chunk) => {
        receivedBytes += chunk.length;
        const progress = ((receivedBytes / contentLength) * 100).toFixed(2);
        progressBar.detail = `${progress}%`;
        fileStream.write(chunk);
      })
      .on("end", async () => {
        fileStream.end();
        progressBar.setCompleted();
        mainWindow.webContents.send(
          "installation-status",
          `Downloaded ${app} successfully`
        );

        fileStream.on("close", async () => {
          const zip = new AdmZip(outputPath);
          try {
            zip.extractAllTo(appFolder, /*overwrite*/ true);

            // Create desktop shortcut
            const exe = getAppExe(app);
            if (exe) {
              createDesktopShortcut(appFolder, exe, app);
            }

            // Delete the ZIP file
            fs.unlink(outputPath, (err) => {
              if (err) {
                console.error(`Error deleting ZIP file: ${err}`);
              } else {
                console.log(`Deleted ZIP file: ${outputPath}`);
              }
            });

            mainWindow.webContents.send(
              "installation-status",
              `Installation complete`
            );
          } catch (err) {
            mainWindow.webContents.send(
              "installation-status",
              `Error installing ${app}: ${err}`
            );
          }
        });
      })
      .on("error", (err) => {
        progressBar.setCompleted();
        mainWindow.webContents.send(
          "installation-status",
          `Error downloading ${app}: ${err}`
        );
      });
  } catch (error) {
    progressBar.setCompleted();
    mainWindow.webContents.send(
      "installation-status",
      `Error downloading ${app}: ${error}`
    );
  }
}
