import { app, BrowserWindow, shell, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDb, closeDb } from './database/connection';
import { runMigrations } from './database/migrate';
import { registerTradeHandlers } from './ipc/trade-handlers';
import { registerStatsHandlers } from './ipc/stats-handlers';
import { registerAIHandlers } from './ipc/ai-handlers';
import { registerSettingsHandlers } from './ipc/settings-handlers';
import { registerQuoteHandlers } from './ipc/quote-handlers';
import { registerImportHandlers } from './ipc/import-handlers';
import { registerGoalHandlers } from './ipc/goal-handlers';
import { registerBriefingHandlers } from './ipc/briefing-handlers';
import { registerJournalHandlers } from './ipc/journal-handlers';
import { registerAccountHandlers } from './ipc/account-handlers';
import { autoBackup, shouldAutoBackup, showNotification } from './services/backup-service';
import { startPriceMonitoring, stopPriceMonitoring } from './services/alert-service';
import { IPC_CHANNELS } from '../shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function isProductionMode(): boolean {
  const rendererIndex = path.join(__dirname, '../../renderer/index.html');
  return fs.existsSync(rendererIndex);
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '股票交易复盘系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Security: disable remote module
      webSecurity: true,
      // Prevent navigation to unknown origins
      webviewTag: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  const useDevMode = isDev || !isProductionMode();
  
  if (useDevMode) {
    const devPort = process.env.VITE_DEV_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = level === 0 ? 'log' : level === 1 ? 'warn' : level === 2 ? 'error' : 'info';
    console.log(`[Renderer ${levelStr}] ${message}`);
    // Also log stack trace for errors
    if (level >= 2) {
      console.log(`[Renderer stack] Line ${line} in ${sourceId}`);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });
}

app.whenReady().then(async () => {
  try {
    // Initialize database
    await initDb();
    runMigrations();

    // Register IPC handlers
    registerTradeHandlers();
    registerStatsHandlers();
    registerAIHandlers();
    registerSettingsHandlers();
    registerQuoteHandlers();
    registerImportHandlers();
    registerGoalHandlers();
    registerBriefingHandlers();
    registerJournalHandlers();
    registerAccountHandlers();

    createWindow();

    // Register global shortcuts
    registerShortcuts();

    // Auto-backup check on startup
    if (shouldAutoBackup()) {
      try {
        await autoBackup();
        showNotification('自动备份', '数据已自动备份');
      } catch (err) {
        console.error('Auto backup failed:', err);
      }
    }

    // Start price monitoring for stop-loss/take-profit alerts
    startPriceMonitoring();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

function registerShortcuts(): void {
  // Ctrl+N: New Trade
  const newTradeRegistered = globalShortcut.register('CommandOrControl+N', () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.SHORTCUT_NEW_TRADE);
    }
  });
  if (!newTradeRegistered) {
    console.warn('Failed to register shortcut: Ctrl+N');
  }

  // Ctrl+R: Refresh
  const refreshRegistered = globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.SHORTCUT_REFRESH);
    }
  });
  if (!refreshRegistered) {
    console.warn('Failed to register shortcut: Ctrl+R');
  }

  // Ctrl+S: Save (will be handled in renderer for forms)
  const saveRegistered = globalShortcut.register('CommandOrControl+S', () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.SHORTCUT_SAVE);
    }
  });
  if (!saveRegistered) {
    console.warn('Failed to register shortcut: Ctrl+S');
  }

  // Ctrl+E: Edit (will be handled in renderer for TradeLog)
  const editRegistered = globalShortcut.register('CommandOrControl+E', () => {
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.SHORTCUT_EDIT);
    }
  });
  if (!editRegistered) {
    console.warn('Failed to register shortcut: Ctrl+E');
  }

  console.log('Global shortcuts registered');
}

app.on('window-all-closed', () => {
  // Stop price monitoring
  stopPriceMonitoring();
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  closeDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDb();
});
