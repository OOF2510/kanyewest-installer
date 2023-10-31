const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const url = require("url");
const fs = require("fs");
const fetch = require('node-fetch');
const extract = require('extract-zip');

let folderPath = "C:/Windows/tracing/KanyeWest";
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 360,
    webPreferences: {
      nodeIntegration: true,
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
  // create folder
  fs.mkdir(folderPath, { recursive: true }, (err) => {
    if (err) {
      console.error(`Error creating folder: ${err}`);
    } else {
      console.log(`Folder created successfully: ${folderPath}`);
    }
  });
  // set perms
  exec(
    `icacls ${folderPath} /grant Users:(OI)(CI)(F) /T`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
      } else {
        console.log(`Command executed successfully: ${stdout}`);
      }
    }
  );

  // Loop through the selected apps and download/extract them
  for (const app of selectedApps) {
    const appUrl = `https://kanyewestappdl.netlify.app/${app}.zip`; // Replace with the actual download URL
    const appFolder = path.join(installationFolder, app);

    try {
      // Download the app ZIP archive
      const response = await fetch(appUrl);
      if (!response.ok) {
        console.error(`Failed to download ${app}: ${response.status}`);
        continue;
      }

      // Create a directory for the app
      fs.mkdir(appFolder, { recursive: true }, (err) => {
        if (err) {
          console.error(`Error creating app folder: ${err}`);
          return;
        }
        console.log(`App folder created successfully: ${appFolder}`);
      });

      // Extract the ZIP archive to the app folder
      await extract(response.body, { dir: appFolder });
      console.log(`App ${app} extracted successfully.`);
    } catch (error) {
      console.error(`Error installing ${app}: ${error}`);
    }
  }

});
