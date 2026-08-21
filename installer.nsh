!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\NunzioTech\Adestio"
!macroend

!macro customInstall
  ExecWait 'netsh advfirewall firewall delete rule group="Adestio"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio App (In)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio App (Out)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Sync (TCP-In)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Discovery (UDP-In)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Sync (TCP-Out)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Discovery (UDP-Out)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P UDP"'
  ExecWait 'netsh advfirewall firewall delete rule name=all program="$INSTDIR\Adestio.exe"'

  ExecWait 'netsh advfirewall firewall add rule name="Adestio App (In)" group="Adestio" dir=in action=allow program="$INSTDIR\Adestio.exe" profile=any edge=yes enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio App (Out)" group="Adestio" dir=out action=allow program="$INSTDIR\Adestio.exe" profile=any enable=yes'

  ExecWait 'netsh advfirewall firewall add rule name="Adestio Sync (TCP-In)" group="Adestio" dir=in action=allow protocol=TCP localport=34567,34568,34569,34570,34571,45891,7345 profile=any edge=yes enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Discovery (UDP-In)" group="Adestio" dir=in action=allow protocol=UDP localport=34568,5353,7346 profile=any edge=yes enable=yes'

  ExecWait 'netsh advfirewall firewall add rule name="Adestio Sync (TCP-Out)" group="Adestio" dir=out action=allow protocol=TCP localport=34567,34568,34569,34570,34571,45891,7345 profile=any enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Discovery (UDP-Out)" group="Adestio" dir=out action=allow protocol=UDP localport=34568,5353,7346 profile=any enable=yes'

  CreateDirectory "$INSTDIR\updates"
  CopyFiles /SILENT "$EXEPATH" "$INSTDIR\updates\$EXEFILE"
!macroend

!macro customUnInstall
  ExecWait 'netsh advfirewall firewall delete rule group="Adestio"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio App (In)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio App (Out)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Sync (TCP-In)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Discovery (UDP-In)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Sync (TCP-Out)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Discovery (UDP-Out)"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P UDP"'
  ExecWait 'netsh advfirewall firewall delete rule name=all program="$INSTDIR\Adestio.exe"'
  
  IfSilent skip_data
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Vuoi rimuovere completamente anche tutti i dati dell'applicazione (database, impostazioni, backup e documenti) salvati sul PC?$\r$\n$\r$\nATTENZIONE: Questa azione eliminerà definitivamente il database locale e i backup di Adestio!" /SD IDNO IDNO skip_data
    RMDir /r "$APPDATA\NunzioTech\Adestio"
    RMDir /r "$DOCUMENTS\NunzioTech\Adestio"
    RMDir /r "$LOCALAPPDATA\adestio-updater"
  skip_data:
!macroend
