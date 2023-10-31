const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const url = require("url");
const fs = require("fs");
const fetch = require("node-fetch");
const extract = require("extract-zip");

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

ipcMain.on("startInstallation", (event, data) => {
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "console.html"),
      protocol: "file:",
      slashes: true,
    })
  );

  const selectedApps = data;
  console.log(`Apps to install: ${selectedApps}`)

  fs.mkdir(folderPath, { recursive: true }, (err) => {
    if (err) {
      mainWindow.webContents.send(
        "installation-status",
        `Error creating folder: ${err}`
      );
    } else {
      mainWindow.webContents.send(
        "installation-status",
        `Folder created successfully: ${folderPath}`
      );
    }
  });

  exec(
    `icacls ${folderPath} /grant Users:(OI)(CI)(F) /T`,
    (error, stdout, stderr) => {
      if (error) {
        mainWindow.webContents.send("installation-status", `Error: ${error}`);
      } else {
        mainWindow.webContents.send(
          "installation-status",
          `Command executed successfully: ${stdout}`
        );
      }
    }
  );

  // Loop through the selected apps and download/extract them
  for (const app of selectedApps) {
    const appUrl = `https://kanyewestappdl.netlify.app/${app}.zip`;
  const appFolder = path.join(folderPath, `${app}`);
    mainWindow.webContents.send("installation-status", `Downloading ${app} from ${appUrl}`);

    fetch(appUrl)
      .then((response) => {
        if (!response.ok) {
          mainWindow.webContents.send("installation-status", `Failed to download ${app}: ${response.status} from ${appUrl}`);
          return Promise.reject(`Failed to download ${app}: ${response.status} from ${appUrl}`);
        }
        return response;
      })
      .then((response) => {
        // Create a directory for the app
        fs.mkdir(appFolder, { recursive: true }, (err) => {
          if (err) {
            mainWindow.webContents.send("installation-status", `Error creating app folder: ${err}`);
          } else {
            mainWindow.webContents.send("installation-status", `App folder created successfully: ${appFolder}`);

            // Extract the ZIP archive to the app folder
            extract(response.body, { dir: appFolder }, (err) => {
              if (err) {
                mainWindow.webContents.send("installation-status", `Error installing ${app}: ${err}`);
              } else {
                mainWindow.webContents.send("installation-status", `App ${app} extracted successfully.`);
              }
            });
          }
        });
      })
      .catch((error) => {
        mainWindow.webContents.send("installation-status", `Error installing ${app}: ${error}`);
      });
  }
});
