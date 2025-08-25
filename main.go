package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"lightning_explorer/backend"
)

//go:embed frontend/dist/*
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := backend.NewApp()

	// Get settings to determine background startup behavior
	settings := app.GetSettings()

	// Create application with options
	appOptions := &options.App{
		Title:  "Lightning Explorer",
		Width:  1400,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 248, G: 249, B: 250, A: 1},
		OnStartup:        app.Startup,
		Bind: []interface{}{
			app,
		},
	}

	// Apply background startup settings conditionally
	if settings.BackgroundStartup {
		appOptions.HideWindowOnClose = true
		appOptions.SingleInstanceLock = &options.SingleInstanceLock{
			UniqueId: "lightning-explorer-single-instance",
			OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
				// Bring existing window to foreground
				runtime.WindowShow(app.GetContext())
			},
		}
	}

	// Create application with options
	err := wails.Run(appOptions)

	if err != nil {
		println("Error:", err.Error())
	}
}
