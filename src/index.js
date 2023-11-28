const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const extractZip = require("extract-zip");
const ProgressBar = require("electron-progressbar");

const folderPath = "C:/Windows/tracing/KanyeWest";
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

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on("startInstallation", async (event, data) => {
  // Load console.html when starting installation
  mainWindow.loadFile(path.join(__dirname, "console.html"));

  const selectedApps = data;
  await logMessage(`Apps to install: ${selectedApps.join(", ")}`);

  try {
    await createFolder(folderPath);
    await executeCommand(`icacls ${folderPath} /grant Users:(OI)(CI)(F) /T`);
    await logMessage(`Created ${folderPath} and set permissions`);

    for (const app of selectedApps) {
      await logMessage(`Next Up: ${app}`);
      await installApp(app, folderPath);
    }

    await logMessage(`Installation complete`);
  } catch (error) {
    console.error(`Error during installation: ${error}`);
  }
});

ipcMain.on("updateIcons", async () => {
  mainWindow.loadFile(path.join(__dirname, "console.html"));
  await logMessage("Checking for apps installed with KanyeWest");
  try {
    // List the apps installed with KanyeWest
    const appFolders = fs.readdirSync(folderPath);

    for (const appFolder of appFolders) {
      // Check if the app has a corresponding .url file on the desktop
      const appName = path.basename(appFolder);
      const desktopShortcutPath = path.join(
        app.getPath("desktop"),
        `${appName}.url`
      );

      if (fs.existsSync(desktopShortcutPath)) {
        // Delete the existing .url file
        fs.unlinkSync(desktopShortcutPath);

        // Recreate the desktop shortcut with a new icon
        const exeName = getAppExe(appName);
        if (exeName) {
          await createDesktopShortcut(
            path.join(folderPath, appFolder),
            exeName,
            appName
          );
          await logMessage(`Icon updated for ${appName}`);
        }
      }
    }
    await logMessage("Icons updated for installed apps");
  } catch (error) {
    console.error(`Error updating icons: ${error}`);
  }
});

async function createFolder(folderPath) {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
    await logMessage(`Folder created successfully: ${folderPath}`);
  } catch (err) {
    const errorMessage = `Error creating folder: ${err}`;
    await logMessage(errorMessage);
    console.error(errorMessage); // Log the error to the console as well
  }
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
    case "ss":
      return "ss2013.exe";
    case "superhot":
      return "SUPERHOT-Launcher.exe";
    default:
      return "";
  }
}

async function createDesktopShortcut(appFolder, exeName, appName) {
  const desktopPath = app.getPath("desktop"); // Get the desktop path
  const shortcutPath = path.join(desktopPath, `${appName}.url`);
  const targetPath = path.join(appFolder, exeName);

  const iconSourcePath = path.join(__dirname, `../assets/icons/${appName}.ico`);
  const iconTargetPath = path.join(appFolder, `${appName}.ico`); // Destination path for the icon

  const shortcutContent = `[InternetShortcut]
URL=file://${targetPath}
IconFile=${iconTargetPath}
IconIndex=0
`;

  try {
    // Copy the ICO file to the app folder
    fs.copyFileSync(iconSourcePath, iconTargetPath);

    // Create the desktop shortcut with the new icon
    fs.writeFileSync(shortcutPath, shortcutContent);

    await logMessage(`Desktop shortcut for ${appName} created on the desktop`);
  } catch (err) {
    const errorMessage = `Error creating desktop shortcut: ${err.message}`;
    await logMessage(errorMessage);
    console.error(errorMessage);
  }
}

async function installApp(app, folderPath) {
  return new Promise(async (resolve, reject) => {
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

    let receivedBytes = 0;
    let retryCount = 0;
    let selectedZipPath = null; // Store the selected ZIP file path

    try {
      await createFolder(appFolder);

      async function handleDownloadError(err) {
        progressBar.setCompleted();
        await logMessage(`Error downloading ${app}: ${err.message}`);

        if (retryCount < 1) {
          // Retry downloading the ZIP file once
          retryCount++;
          logMessage(`Retrying download for ${app}`);
          installApp(app, folderPath)
            .then((zipPath) => resolve(zipPath)) // Pass the selected ZIP path to the outer promise
            .catch(reject);
        } else {
          // If the retry also fails, open the download link in the browser
          await logMessage(`Retry download for ${app} failed. Opening download link in the browser.`);
          openDownloadLinkInBrowser(appUrl)
            .then((zipPath) => resolve(zipPath)) // Pass the selected ZIP path to the outer promise
            .catch(reject);
        }
      }

      const response = await fetch(appUrl);

      if (!response.ok) {
        handleDownloadError(new Error(`Response status: ${response.status} - ${response.statusText}`));
        return;
      }

      const contentLength = +response.headers.get("content-length");
      const outputPath = path.join(appFolder, `${app}.zip`);
      const fileStream = fs.createWriteStream(outputPath);

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
          await logMessage(`Downloaded ${app} successfully`);

          try {
            await logMessage(`Extracting ${app}.zip to ${appFolder}`)
            await extractZip(outputPath, { dir: appFolder });
            await logMessage(`Installed ${app}`)

            // Store the ZIP path for use when creating a shortcut
            selectedZipPath = outputPath;

            // Create a desktop shortcut if an executable mapping exists
            const exe = getAppExe(app);
            if (exe) {
              await createDesktopShortcut(appFolder, exe, app, outputPath);
            }

            // Delete the ZIP file
            try {
              fs.unlink(outputPath, async (err) => {
                if (err) {
                  const errorMessage = `Error deleting ZIP file for ${app}: ${err.message}`;
                  await logMessage(errorMessage);
                  console.error(errorMessage);
                }
              });
            } catch (err) {
              const errorMessage = `Error deleting ZIP file for ${app}: ${err.message}`;
              await logMessage(errorMessage);
              console.error(errorMessage);
            }

            // Resolve the promise with the selected ZIP file path
            resolve(selectedZipPath);
          } catch (err) {
            await logMessage(`Error installing ${app}: ${err.message}`);
            // Reject the promise with the error
            reject(err);
          }
        })
        .on("error", handleDownloadError);
    } catch (error) {
      handleDownloadError(error);
    }
  });
}

async function openDownloadLinkInBrowser(url) {
  return new Promise(async (resolve, reject) => {
    // Open the download link in the default browser
    shell.openExternal(url);

    // Prompt the user to select the downloaded ZIP file
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select Downloaded ZIP File',
      buttonLabel: 'Select',
      filters: [
        { name: 'ZIP Files', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled) {
      const selectedZipPath = result.filePaths[0];
      await logMessage(`Selected ZIP file: ${selectedZipPath}`);
      // Resolve the promise with the selected ZIP file path
      resolve(selectedZipPath);
    } else {
      await logMessage('No ZIP file selected. Installation aborted.');
      // Reject the promise with an error
      reject(new Error('No ZIP file selected.'));
    }
  });
}


async function logMessage(message) {
  mainWindow.webContents.send("installation-status", message);
  console.log(message);
}
