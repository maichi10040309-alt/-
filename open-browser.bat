@echo off
ping -n 7 127.0.0.1 >nul
start "" http://localhost:4000/
