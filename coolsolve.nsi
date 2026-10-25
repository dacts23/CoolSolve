!include "MUI2.nsh"

!define VERSION "0.4.2"
!define COOLPROP_VERSION "8.1.0dev (75af7816)"

Name "CoolSolve-Canary ${VERSION}"
OutFile "CoolSolve-Canary_v${VERSION}_Installer.exe"
InstallDir "$PROGRAMFILES64\CoolSolve-Canary"
InstallDirRegKey HKCU "Software\CoolSolve-Canary" ""

RequestExecutionLevel admin

!define MUI_ABORTWARNING
!define MUI_ICON "docs\coolsolve.ico"
!define MUI_UNICON "docs\coolsolve.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "CoolSolve" Section_Main
    ; Close any running instance of CoolSolve so the executable is not locked
    ExecWait 'taskkill /F /IM coolsolve.exe'
    Sleep 500

    SetOutPath "$INSTDIR"
    File "build\Release\coolsolve.exe"
    ; If we had external DLLs, they would go here
    ; No example models: the GUI offers the model library embedded in coolsolve.exe.
    ; Remove the examples folder installed by versions up to 0.3.
    RMDir /r "$INSTDIR\examples"

    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Add to Start Menu
    CreateShortcut "$SMPROGRAMS\CoolSolve-Canary.lnk" "$INSTDIR\coolsolve.exe" "" "$INSTDIR\coolsolve.exe" 0
    
    ; File Association for .eescode files (isolated ProgID so original CoolSolve.EESCode is untouched)
    WriteRegStr HKCR "CoolSolveCanary.EESCode" "" "CoolSolve-Canary Equation Set"
    WriteRegStr HKCR "CoolSolveCanary.EESCode\DefaultIcon" "" "$INSTDIR\coolsolve.exe,0"
    WriteRegStr HKCR "CoolSolveCanary.EESCode\shell\open\command" "" '"$INSTDIR\coolsolve.exe" --gui "%1"'
    
    ; Add to Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSolve-Canary" "DisplayName" "CoolSolve-Canary ${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSolve-Canary" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSolve-Canary" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSolve-Canary" "DisplayIcon" "$INSTDIR\coolsolve.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSolve-Canary" "Publisher" "CoolSolve-Canary"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\coolsolve.exe"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir /r "$INSTDIR\examples"
    RMDir "$INSTDIR"
    
    Delete "$SMPROGRAMS\CoolSolve-Canary.lnk"
    
    DeleteRegKey HKCR "CoolSolveCanary.EESCode"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoolSolve-Canary"
SectionEnd
