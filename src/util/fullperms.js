/**
 * 
 * @param {string} folderPath path of folder to set permissions for
 */
function grantPermissions(folderPath) {
    // Run the icacls command
    const command = `icacls ${folderPath} /grant Users:(OI)(CI)(F) /T`;
    require('child_process').exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
      } else {
        console.log(`Command executed successfully: ${stdout}`);
      }
    });
  }

// export function
exports = [grantPermissions]
