!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\NunzioTech\Adestio"
!macroend

!macro customInstall
  ; Pulizia radicale di qualsiasi vecchia regola (anche di blocco) associata all'eseguibile
  ExecWait 'netsh advfirewall firewall delete rule name=all program="$INSTDIR\Adestio.exe"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P UDP"'
  ExecWait 'netsh advfirewall firewall delete rule group="Adestio"'

  ; Regole generiche "Adestio" (impedisce la creazione di nuove regole disabilitate da parte di Windows)
  ExecWait 'netsh advfirewall firewall add rule name="Adestio" dir=in action=allow program="$INSTDIR\Adestio.exe" profile=any enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio" dir=out action=allow program="$INSTDIR\Adestio.exe" profile=any enable=yes'

  ; Creazione delle nuove regole per l'eseguibile (App consentita su tutte le reti)
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Sync (TCP-In)" group="Adestio" dir=in action=allow protocol=TCP localport=34567 program="$INSTDIR\Adestio.exe" profile=any edge=yes enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Discovery (UDP-In)" group="Adestio" dir=in action=allow protocol=UDP localport=34568 program="$INSTDIR\Adestio.exe" profile=any edge=yes enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio mDNS Bonjour (UDP-In)" group="Adestio" dir=in action=allow protocol=UDP localport=5353 program="$INSTDIR\Adestio.exe" profile=any edge=yes enable=yes'

  ; Outbound Rules
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Sync (TCP-Out)" group="Adestio" dir=out action=allow protocol=TCP localport=34567 program="$INSTDIR\Adestio.exe" profile=any enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Discovery (UDP-Out)" group="Adestio" dir=out action=allow protocol=UDP localport=34568 program="$INSTDIR\Adestio.exe" profile=any enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio mDNS Bonjour (UDP-Out)" group="Adestio" dir=out action=allow protocol=UDP localport=5353 program="$INSTDIR\Adestio.exe" profile=any enable=yes'

  CreateDirectory "$INSTDIR\updates"
  CopyFiles /SILENT "$EXEPATH" "$INSTDIR\updates\$EXEFILE"
!macroend

!macro customUnInstall
  ; Rimuove l'intero gruppo in un colpo solo
  ExecWait 'netsh advfirewall firewall delete rule group="Adestio"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P UDP"'
  
  IfSilent skip_data
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Vuoi rimuovere completamente anche tutti i dati dell'applicazione (database, impostazioni, backup e documenti) salvati sul PC?$\r$\n$\r$\nATTENZIONE: Questa azione eliminerà definitivamente il database locale e i backup di Adestio!" /SD IDNO IDNO skip_data
    RMDir /r "$APPDATA\NunzioTech\Adestio"
    RMDir /r "$DOCUMENTS\NunzioTech\Adestio"
    RMDir /r "$LOCALAPPDATA\adestio-updater"
  skip_data:
!macroend
