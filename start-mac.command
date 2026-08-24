#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js がインストールされていません。"
  echo "https://nodejs.org/ からインストールしてから、もう一度このファイルをダブルクリックしてください。"
  read -p "Enterキーで終了します..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "初回起動のため、必要なファイルをインストールしています。少々お待ちください..."
  npm install
  if [ $? -ne 0 ]; then
    echo "インストールに失敗しました。"
    read -p "Enterキーで終了します..."
    exit 1
  fi
fi

echo ""
echo "販売管理ソフトを起動しています..."
echo "(このパソコンをサーバーにします。他のパソコンから使う場合は、表示されるURLをそちらのブラウザで開いてください)"
echo "終了するときは、このウィンドウを閉じるか Ctrl+C を押してください。"
echo ""

( sleep 6 && open http://localhost:4000/ ) &
npm run start
