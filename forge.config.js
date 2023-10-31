module.exports = {
  packagerConfig: {
    platform: 'win32', // Specify the target platform as Windows
    arch: 'x64',      // Specify the target architecture, e.g., x64
    asar: true,
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'], // Specify the target platform as Windows
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
