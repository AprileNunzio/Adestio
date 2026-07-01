!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\NunzioTech\Adestio"
!macroend
!macro customInstall
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Blockchain P2P" dir=in action=allow protocol=TCP localport=34567,34568'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Blockchain P2P UDP" dir=in action=allow protocol=UDP localport=34567,34568'
!macroend
!macro customUnInstall
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P UDP"'
  IfSilent skip_data
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Vuoi rimuovere completamente anche tutti i dati dell'applicazione (database, impostazioni, backup e documenti) salvati sul PC?$\r$\n$\r$\nATTENZIONE: Questa azione eliminerà definitivamente il database locale e i backup di Adestio!" /SD IDNO IDNO skip_data
    RMDir /r "$APPDATA\NunzioTech\Adestio"
    RMDir /r "$DOCUMENTS\NunzioTech\Adestio"
    RMDir /r "$LOCALAPPDATA\adestio-updater"
  skip_data:
!macroend
