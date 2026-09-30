/**
 * JetBrains 产品注册表与官方正版矢量图标元数据字典
 */

// 辅助生成标准 SVG Data URL
const toSvgDataUrl = (svgString) => `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

// 1. IntelliJ IDEA 官方正版矢量 Logo
const SVG_IDEA = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.95 5.82L4.07 5.82C1.82 5.82 0 7.64 0 9.89V21.4C0 22.59 0.52 23.72 1.42 24.49L39.58 57.2C40.32 57.83 41.26 58.18 42.23 58.18H54.11C56.36 58.18 58.18 56.36 58.18 54.11V42.6C58.18 41.41 57.66 40.28 56.76 39.51L18.6 6.8C17.86 6.17 16.92 5.82 15.95 5.82Z" fill="#FF8100"/><path d="M14.52 5.82H4.07C1.82 5.82 0 7.64 0 9.89V22.98C0 23.18 0.01 23.37 0.04 23.56L5.32 60.5C5.6 62.51 7.32 64 9.35 64H25.02C27.27 64 29.1 62.18 29.1 59.93L29.09 41.39C29.09 40.95 29.02 40.52 28.88 40.1L18.38 8.6C17.83 6.94 16.27 5.82 14.52 5.82Z" fill="url(#ij_g0)"/><path d="M59.93 0H25.96C24.33 0 22.86 0.97 22.22 2.47L6.15 39.96C5.93 40.47 5.82 41.01 5.82 41.56V59.93C5.82 62.18 7.64 64 9.89 64H27.86C28.66 64 29.45 63.76 30.12 63.31L62.19 41.91C63.32 41.16 64 39.88 64 38.52L64 4.07C64 1.82 62.18 0 59.93 0Z" fill="url(#ij_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M17 29.39H19.98V19.61H17V17H25.84V19.61H22.86V29.39H25.84V32H17V29.39Z" fill="white"/><path d="M27.34 29.3H29.49C29.93 29.3 30.32 29.21 30.66 29.02C31 28.84 31.26 28.57 31.44 28.23C31.63 27.9 31.72 27.51 31.72 27.07V17H34.65V27.27C34.65 28.17 34.44 28.98 34.02 29.7C33.61 30.42 33.04 30.98 32.31 31.39C31.58 31.8 30.76 32 29.86 32H27.34V29.3Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="ij_g0" x1="-0.72" y1="7.62" x2="24.15" y2="61.25" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#FC801D"/><stop offset="0.59" stop-color="#FE2857"/></linearGradient><linearGradient id="ij_g1" x1="4.22" y1="60.02" x2="62.93" y2="1.31" gradientUnits="userSpaceOnUse"><stop offset="0.21" stop-color="#FE2857"/><stop offset="0.7" stop-color="#007EFF"/></linearGradient></defs></svg>`;

// 2. PyCharm 官方正版矢量 Logo
const SVG_PYCHARM = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.82 48.05L5.82 59.93C5.82 62.18 7.64 64 9.89 64H21.4C22.59 64 23.72 63.48 24.49 62.58L57.2 24.42C57.83 23.68 58.18 22.74 58.18 21.77V9.89C58.18 7.64 56.36 5.82 54.11 5.82H42.6C41.41 5.82 40.28 6.34 39.51 7.24L6.8 45.4C6.17 46.14 5.82 47.08 5.82 48.05Z" fill="#00D886"/><path d="M5.82 49.48V59.93C5.82 62.18 7.64 64 9.89 64H22.98C23.18 64 23.37 63.99 23.56 63.96L60.5 58.68C62.51 58.4 64 56.68 64 54.65V38.98C64 36.73 62.18 34.9 59.93 34.9L41.39 34.91C40.95 34.91 40.52 34.98 40.1 35.12L8.6 45.62C6.94 46.17 5.82 47.73 5.82 49.48Z" fill="url(#pc_g0)"/><path d="M0 4.07V38.04C0 39.67 0.97 41.14 2.47 41.78L39.96 57.85C40.47 58.07 41.01 58.18 41.56 58.18H59.93C62.18 58.18 64 56.36 64 54.11V36.14C64 35.34 63.76 34.55 63.31 33.88L41.91 1.81C41.16 0.68 39.89 0 38.52 0L4.07 0C1.82 0 0 1.82 0 4.07Z" fill="url(#pc_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M17.1 16.97H23.54C24.59 16.97 25.52 17.16 26.32 17.55C27.12 17.93 27.73 18.47 28.16 19.17C28.6 19.87 28.82 20.69 28.82 21.61C28.82 22.53 28.59 23.36 28.15 24.07C27.72 24.78 27.09 25.33 26.28 25.72C25.47 26.11 24.53 26.3 23.46 26.3H20.03V31.97H17.1V16.97ZM23.35 23.87C23.84 23.87 24.27 23.78 24.63 23.6C25.01 23.42 25.29 23.16 25.49 22.82C25.69 22.48 25.79 22.08 25.79 21.63C25.79 21.18 25.69 20.78 25.49 20.45C25.29 20.11 25.01 19.86 24.63 19.68C24.27 19.49 23.84 19.4 23.35 19.4H20.03V23.87H23.35ZM37.29 32.23C35.85 32.23 34.55 31.89 33.39 31.22C32.22 30.54 31.31 29.61 30.64 28.44C29.98 27.25 29.65 25.93 29.65 24.47C29.65 23.01 29.98 21.69 30.64 20.51C31.31 19.33 32.22 18.4 33.39 17.73C34.55 17.05 35.85 16.71 37.29 16.71C38.5 16.71 39.62 16.94 40.63 17.39C41.65 17.84 42.49 18.47 43.16 19.28C43.84 20.09 44.3 21.02 44.52 22.07H41.46C41.26 21.53 40.96 21.05 40.56 20.64C40.17 20.23 39.69 19.91 39.13 19.69C38.58 19.47 37.97 19.36 37.31 19.36C36.42 19.36 35.62 19.58 34.91 20.02C34.2 20.46 33.63 21.08 33.23 21.85C32.83 22.63 32.63 23.5 32.63 24.47C32.63 25.44 32.83 26.32 33.23 27.1C33.63 27.87 34.2 28.47 34.91 28.92C35.62 29.36 36.42 29.58 37.31 29.58C37.97 29.58 38.58 29.47 39.13 29.25C39.69 29.03 40.17 28.71 40.56 28.31C40.96 27.89 41.26 27.41 41.46 26.87H44.52C44.3 27.92 43.84 28.85 43.16 29.67C42.49 30.48 41.65 31.1 40.63 31.55C39.62 32 38.5 32.23 37.29 32.23Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="pc_g0" x1="7.62" y1="64.72" x2="61.25" y2="39.85" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#00D886"/><stop offset="0.59" stop-color="#F0EB18"/></linearGradient><linearGradient id="pc_g1" x1="60.02" y1="59.78" x2="1.31" y2="1.07" gradientUnits="userSpaceOnUse"><stop offset="0.3" stop-color="#F0EB18"/><stop offset="0.7" stop-color="#00C4F4"/></linearGradient></defs></svg>`;

// 3. RustRover 官方正版矢量 Logo
const SVG_RUSTROVER = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.82 48.05L5.82 59.93C5.82 62.18 7.64 64 9.89 64H21.4C22.59 64 23.72 63.48 24.49 62.58L57.2 24.42C57.83 23.68 58.18 22.74 58.18 21.77V9.89C58.18 7.64 56.36 5.82 54.11 5.82H42.6C41.41 5.82 40.28 6.34 39.51 7.24L6.8 45.4C6.17 46.14 5.82 47.08 5.82 48.05Z" fill="#00D886"/><path d="M5.82 49.48V59.93C5.82 62.18 7.64 64 9.89 64H22.98C23.18 64 23.37 63.99 23.56 63.96L60.5 58.68C62.51 58.4 64 56.68 64 54.65V38.98C64 36.73 62.18 34.9 59.93 34.9L41.39 34.91C40.95 34.91 40.52 34.98 40.1 35.12L8.6 45.62C6.94 46.17 5.82 47.73 5.82 49.48Z" fill="url(#rr_g0)"/><path d="M0 4.07V38.04C0 39.67 0.97 41.14 2.47 41.78L39.96 57.85C40.47 58.07 41.01 58.18 41.56 58.18H59.93C62.18 58.18 64 56.36 64 54.11V36.14C64 35.34 63.76 34.55 63.31 33.88L41.91 1.81C41.16 0.68 39.89 0 38.52 0L4.07 0C1.82 0 0 1.82 0 4.07Z" fill="url(#rr_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M43.57 32L40 25.99C40.24 25.92 40.49 25.86 40.71 25.76C41.53 25.36 42.15 24.81 42.59 24.1C43.03 23.39 43.25 22.57 43.25 21.63C43.25 20.7 43.03 19.91 42.6 19.21C42.17 18.51 41.55 17.96 40.75 17.58C39.95 17.19 39.03 17 37.98 17H31.54V32H34.46V26.33H36.99L40.22 32H43.57ZM34.47 19.44H37.79C38.28 19.44 38.71 19.53 39.07 19.71C39.44 19.89 39.73 20.15 39.93 20.48C40.13 20.82 40.23 21.21 40.23 21.66C40.23 22.12 40.13 22.51 39.93 22.85C39.73 23.19 39.44 23.44 39.07 23.63C38.71 23.82 38.28 23.9 37.79 23.9H34.47V19.44ZM20.03 26.33H22.55L25.78 32H29.13L25.56 25.99C25.8 25.92 26.05 25.86 26.27 25.76C27.09 25.36 27.71 24.81 28.15 24.1C28.59 23.39 28.81 22.57 28.81 21.63C28.81 20.7 28.59 19.91 28.16 19.21C27.73 18.51 27.11 17.96 26.31 17.58C25.51 17.19 24.59 17 23.54 17H17.1V32H20.02V26.33ZM20.03 19.44H23.35C23.84 19.44 24.27 19.53 24.63 19.71C25 19.89 25.29 20.15 25.49 20.48C25.69 20.82 25.79 21.21 25.79 21.66C25.79 22.12 25.69 22.51 25.49 22.85C25.29 23.19 25 23.44 24.63 23.63C24.27 23.82 23.84 23.9 23.35 23.9H20.03V19.44Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="rr_g0" x1="7.62" y1="64.72" x2="61.25" y2="39.85" gradientUnits="userSpaceOnUse"><stop offset="0.08" stop-color="#00D886"/><stop offset="0.46" stop-color="#FFAB00"/></linearGradient><linearGradient id="rr_g1" x1="60.02" y1="59.78" x2="1.31" y2="1.07" gradientUnits="userSpaceOnUse"><stop offset="0.19" stop-color="#FFAB00"/><stop offset="0.83" stop-color="#FF004C"/></linearGradient></defs></svg>`;

// 4. WebStorm 官方正版矢量 Logo
const SVG_WEBSTORM = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M59.93 0H25.96C24.33 0 22.86 0.97 22.22 2.47L6.15 39.96C5.93 40.47 5.82 41.01 5.82 41.56V59.93C5.82 62.18 7.64 64 9.89 64H27.86C28.66 64 29.45 63.76 30.12 63.31L62.19 41.91C63.32 41.16 64 39.88 64 38.52L64 4.07C64 1.82 62.18 0 59.93 0Z" fill="url(#ws_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M16 17H19.5L22.5 27.5L25.5 17H28.5L31.5 27.5L34.5 17H38L33 32H29.5L27 23L24.5 32H21L16 17Z" fill="white"/><path d="M39 29.5C39.8 30.3 40.8 30.7 42 30.7C42.8 30.7 43.5 30.5 44 30.1C44.5 29.7 44.8 29.2 44.8 28.6C44.8 28 44.5 27.6 44.1 27.3C43.7 27 42.9 26.7 41.8 26.4C40.3 26 39.2 25.4 38.5 24.7C37.8 24 37.4 23 37.4 21.8C37.4 20.3 38 19.1 39.1 18.2C40.2 17.3 41.6 16.9 43.3 16.9C44.7 16.9 45.9 17.3 46.9 18.1C47.9 18.9 48.5 19.9 48.6 21.2H45.4C45.2 20.6 44.9 20.1 44.4 19.8C43.9 19.5 43.3 19.3 42.7 19.3C42 19.3 41.4 19.5 41 19.8C40.6 20.1 40.4 20.6 40.4 21.1C40.4 21.6 40.6 22 41 22.3C41.4 22.6 42.2 22.9 43.3 23.2C44.9 23.6 46.1 24.2 46.8 24.9C47.5 25.6 47.9 26.6 47.9 27.9C47.9 29.4 47.3 30.6 46.2 31.4C45.1 32.2 43.6 32.7 41.8 32.7C40.3 32.7 39 32.3 38 31.4C37 30.5 36.4 29.3 36.3 27.8H39.5C39.6 28.5 39.8 29.1 39 29.5Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="ws_g1" x1="4.22" y1="60.02" x2="62.93" y2="1.31" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#00CDD7"/><stop offset="0.9" stop-color="#087CFA"/></linearGradient></defs></svg>`;

// 5. GoLand 官方正版矢量 Logo
const SVG_GOLAND = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M59.93 0H25.96C24.33 0 22.86 0.97 22.22 2.47L6.15 39.96C5.93 40.47 5.82 41.01 5.82 41.56V59.93C5.82 62.18 7.64 64 9.89 64H27.86C28.66 64 29.45 63.76 30.12 63.31L62.19 41.91C63.32 41.16 64 39.88 64 38.52L64 4.07C64 1.82 62.18 0 59.93 0Z" fill="url(#go_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M26 24.5C26 22.2 25.3 20.4 23.9 19.1C22.5 17.8 20.6 17.1 18.2 17.1C15.8 17.1 13.9 17.8 12.5 19.1C11.1 20.4 10.4 22.2 10.4 24.5C10.4 26.8 11.1 28.6 12.5 29.9C13.9 31.2 15.8 31.9 18.2 31.9C20.6 31.9 22.5 31.2 23.9 29.9C25.3 28.6 26 26.8 26 24.5ZM22.8 24.5C22.8 26 22.4 27.2 21.6 28C20.8 28.8 19.7 29.2 18.2 29.2C16.7 29.2 15.6 28.8 14.8 28C14 27.2 13.6 26 13.6 24.5C13.6 23 14 21.8 14.8 21C15.6 20.2 16.7 19.8 18.2 19.8C19.7 19.8 20.8 20.2 21.6 21C22.4 21.8 22.8 23 22.8 24.5ZM28 17.3H31V28.9C31 29.8 31.3 30.5 31.9 31C32.5 31.5 33.3 31.7 34.3 31.7C35.3 31.7 36.1 31.5 36.7 31C37.3 30.5 37.6 29.8 37.6 28.9V17.3H40.6V28.9C40.6 30.7 40 32.1 38.8 33C37.6 33.9 36.1 34.4 34.3 34.4C32.5 34.4 31 33.9 29.8 33C28.6 32.1 28 30.7 28 28.9V17.3Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="go_g1" x1="4.22" y1="60.02" x2="62.93" y2="1.31" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#00ADD8"/><stop offset="0.9" stop-color="#248BE3"/></linearGradient></defs></svg>`;

// 6. CLion 官方正版矢量 Logo
const SVG_CLION = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M59.93 0H25.96C24.33 0 22.86 0.97 22.22 2.47L6.15 39.96C5.93 40.47 5.82 41.01 5.82 41.56V59.93C5.82 62.18 7.64 64 9.89 64H27.86C28.66 64 29.45 63.76 30.12 63.31L62.19 41.91C63.32 41.16 64 39.88 64 38.52L64 4.07C64 1.82 62.18 0 59.93 0Z" fill="url(#cl_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M25 24.5C25 22.2 24.3 20.4 22.9 19.1C21.5 17.8 19.6 17.1 17.2 17.1C14.8 17.1 12.9 17.8 11.5 19.1C10.1 20.4 9.4 22.2 9.4 24.5C9.4 26.8 10.1 28.6 11.5 29.9C12.9 31.2 14.8 31.9 17.2 31.9C19.6 31.9 21.5 31.2 22.9 29.9C24.3 28.6 25 26.8 25 24.5ZM21.8 24.5C21.8 26 21.4 27.2 20.6 28C19.8 28.8 18.7 29.2 17.2 29.2C15.7 29.2 14.6 28.8 13.8 28C13 27.2 12.6 26 12.6 24.5C12.6 23 13 21.8 13.8 21C14.6 20.2 15.7 19.8 17.2 19.8C18.7 19.8 19.8 20.2 20.6 21C21.4 21.8 21.8 23 21.8 24.5ZM28 17.3H31V28.9H39V31.9H28V17.3Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="cl_g1" x1="4.22" y1="60.02" x2="62.93" y2="1.31" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#21D789"/><stop offset="0.9" stop-color="#0098FF"/></linearGradient></defs></svg>`;

// 7. Rider 官方正版矢量 Logo
const SVG_RIDER = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M59.93 0H25.96C24.33 0 22.86 0.97 22.22 2.47L6.15 39.96C5.93 40.47 5.82 41.01 5.82 41.56V59.93C5.82 62.18 7.64 64 9.89 64H27.86C28.66 64 29.45 63.76 30.12 63.31L62.19 41.91C63.32 41.16 64 39.88 64 38.52L64 4.07C64 1.82 62.18 0 59.93 0Z" fill="url(#rd_g1)"/><rect x="12" y="12" width="40" height="40" rx="4" fill="black"/><path d="M20 26.3H22.5L25.8 32H29.1L25.6 26C25.8 25.9 26.1 25.9 26.3 25.8C27.1 25.4 27.7 24.8 28.1 24.1C28.6 23.4 28.8 22.6 28.8 21.6C28.8 20.7 28.6 19.9 28.2 19.2C27.7 18.5 27.1 18 26.3 17.6C25.5 17.2 24.6 17 23.5 17H17.1V32H20V26.3ZM20 19.4H23.3C23.8 19.4 24.3 19.5 24.6 19.7C25 19.9 25.3 20.1 25.5 20.5C25.7 20.8 25.8 21.2 25.8 21.7C25.8 22.1 25.7 22.5 25.5 22.8C25.3 23.2 25 23.4 24.6 23.6C24.3 23.8 23.8 23.9 23.3 23.9H20V19.4ZM32 17H37.5C39.5 17 41.1 17.6 42.2 18.7C43.3 19.8 43.9 21.3 43.9 23.2V25.8C43.9 27.7 43.3 29.2 42.2 30.3C41.1 31.4 39.5 32 37.5 32H32V17ZM35 29.2H37.4C38.5 29.2 39.4 28.8 40 28.1C40.6 27.4 40.9 26.4 40.9 25.1V23.9C40.9 22.6 40.6 21.6 40 20.9C39.4 20.2 38.5 19.8 37.4 19.8H35V29.2Z" fill="white"/><rect x="17" y="44" width="16" height="3" fill="white"/><defs><linearGradient id="rd_g1" x1="4.22" y1="60.02" x2="62.93" y2="1.31" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#B83BCE"/><stop offset="0.9" stop-color="#E91E63"/></linearGradient></defs></svg>`;

// 8. 通用 JetBrains 官方正版矢量 Logo (Default)
const SVG_JETBRAINS_DEFAULT = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#000000"/><path d="M52 14H12V50H52V14Z" fill="#1E1F22"/><path d="M16 42H48V46H16V42Z" fill="#FE2857"/><path d="M16 20H24V24H16V20ZM16 28H36V32H16V28ZM16 36H44V40H16V36Z" fill="#FFFFFF"/></svg>`;

export const JETBRAINS_PRODUCTS = [
  {
    code: "IU",
    name: "IntelliJ IDEA",
    shortName: "IDEA",
    dirPattern: /^IntelliJIdea/i,
    executables: ["idea64.exe", "idea.exe", "idea"],
    macAppName: "IntelliJ IDEA.app",
    color: "#FE315D",
    icon: toSvgDataUrl(SVG_IDEA)
  },
  {
    code: "WS",
    name: "WebStorm",
    shortName: "WebStorm",
    dirPattern: /^WebStorm/i,
    executables: ["webstorm64.exe", "webstorm.exe", "webstorm"],
    macAppName: "WebStorm.app",
    color: "#00CDD7",
    icon: toSvgDataUrl(SVG_WEBSTORM)
  },
  {
    code: "PC",
    name: "PyCharm",
    shortName: "PyCharm",
    dirPattern: /^PyCharm/i,
    executables: ["pycharm64.exe", "pycharm.exe", "pycharm"],
    macAppName: "PyCharm.app",
    color: "#21D789",
    icon: toSvgDataUrl(SVG_PYCHARM)
  },
  {
    code: "GO",
    name: "GoLand",
    shortName: "GoLand",
    dirPattern: /^GoLand/i,
    executables: ["goland64.exe", "goland.exe", "goland"],
    macAppName: "GoLand.app",
    color: "#00ADD8",
    icon: toSvgDataUrl(SVG_GOLAND)
  },
  {
    code: "CL",
    name: "CLion",
    shortName: "CLion",
    dirPattern: /^CLion/i,
    executables: ["clion64.exe", "clion.exe", "clion"],
    macAppName: "CLion.app",
    color: "#21D789",
    icon: toSvgDataUrl(SVG_CLION)
  },
  {
    code: "RR",
    name: "RustRover",
    shortName: "RustRover",
    dirPattern: /^RustRover/i,
    executables: ["rustrover64.exe", "rustrover.exe", "rustrover"],
    macAppName: "RustRover.app",
    color: "#F25F22",
    icon: toSvgDataUrl(SVG_RUSTROVER)
  },
  {
    code: "RD",
    name: "Rider",
    shortName: "Rider",
    dirPattern: /^Rider/i,
    executables: ["rider64.exe", "rider.exe", "rider"],
    macAppName: "Rider.app",
    color: "#B83BCE",
    icon: toSvgDataUrl(SVG_RIDER)
  },
  {
    code: "DB",
    name: "DataGrip",
    shortName: "DataGrip",
    dirPattern: /^DataGrip/i,
    executables: ["datagrip64.exe", "datagrip.exe", "datagrip"],
    macAppName: "DataGrip.app",
    color: "#FF318C",
    icon: toSvgDataUrl(SVG_IDEA)
  },
  {
    code: "RM",
    name: "RubyMine",
    shortName: "RubyMine",
    dirPattern: /^RubyMine/i,
    executables: ["rubymine64.exe", "rubymine.exe", "rubymine"],
    macAppName: "RubyMine.app",
    color: "#FC3165",
    icon: toSvgDataUrl(SVG_IDEA)
  },
  {
    code: "FL",
    name: "Fleet",
    shortName: "Fleet",
    dirPattern: /^Fleet/i,
    executables: ["fleet.exe", "fleet"],
    macAppName: "Fleet.app",
    color: "#8348FF",
    icon: toSvgDataUrl(SVG_JETBRAINS_DEFAULT)
  },
  {
    code: "AQ",
    name: "Aqua",
    shortName: "Aqua",
    dirPattern: /^Aqua/i,
    executables: ["aqua64.exe", "aqua.exe", "aqua"],
    macAppName: "Aqua.app",
    color: "#00C9FF",
    icon: toSvgDataUrl(SVG_JETBRAINS_DEFAULT)
  }
];

export const DEFAULT_PRODUCT = {
  code: "JB",
  name: "JetBrains IDE",
  shortName: "JetBrains",
  dirPattern: /.*/,
  executables: ["idea64.exe", "idea"],
  macAppName: "",
  color: "#6B7280",
  icon: toSvgDataUrl(SVG_JETBRAINS_DEFAULT)
};

/**
 * 根据目录名识别对应的 JetBrains 产品
 * @param {string} dirName 如 "IntelliJIdea2026.2" 或 "WebStorm2024.1"
 */
export function matchProductByDirectory(dirName) {
  if (!dirName) return DEFAULT_PRODUCT;
  for (const product of JETBRAINS_PRODUCTS) {
    if (product.dirPattern.test(dirName)) {
      return product;
    }
  }
  return DEFAULT_PRODUCT;
}
