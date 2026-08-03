// キャラクター/店舗の実イラスト素材(ユーザー提供)。
// Vite の assetsInlineLimit 設定により、ビルド時に base64 データURIとして
// JS に埋め込まれるため、Artifact 等の単一HTML書き出しでも別ファイル参照なしで動く。

import strawberry from '@/assets/characters/strawberry.png';
import white from '@/assets/characters/white.png';
import bitter from '@/assets/characters/bitter.png';
import milk from '@/assets/characters/milk.png';
import matcha from '@/assets/characters/matcha.png';
import crunch from '@/assets/characters/crunch.png';
import marron from '@/assets/characters/marron.png';
import champagne from '@/assets/characters/champagne.png';
import peche from '@/assets/characters/peche.png';
import pomme from '@/assets/characters/pomme.png';
import almond from '@/assets/characters/almond.png';
import honey from '@/assets/characters/honey.png';
import caramel from '@/assets/characters/caramel.png';
import blueberry from '@/assets/characters/blueberry.png';
import maple from '@/assets/characters/maple.png';
import cinnamon from '@/assets/characters/cinnamon.png';
import lemon from '@/assets/characters/lemon.png';
import vanilla from '@/assets/characters/vanilla.png';

import strawberryShop from '@/assets/buildings/strawberry_shop.png';
import whiteShop from '@/assets/buildings/white_shop.png';
import bitterShop from '@/assets/buildings/bitter_shop.png';
import milkShop from '@/assets/buildings/milk_shop.png';
import matchaShop from '@/assets/buildings/matcha_shop.png';
import crunchShop from '@/assets/buildings/crunch_shop.png';
import marronShop from '@/assets/buildings/marron_shop.png';
import champagneShop from '@/assets/buildings/champagne_shop.png';
import pecheShop from '@/assets/buildings/peche_shop.png';
import pommeShop from '@/assets/buildings/pomme_shop.png';
import almondShop from '@/assets/buildings/almond_shop.png';
import honeyShop from '@/assets/buildings/honey_shop.png';
import caramelShop from '@/assets/buildings/caramel_shop.png';
import blueberryShop from '@/assets/buildings/blueberry_shop.png';
import mapleShop from '@/assets/buildings/maple_shop.png';
import cinnamonShop from '@/assets/buildings/cinnamon_shop.png';
import lemonShop from '@/assets/buildings/lemon_shop.png';
import vanillaShop from '@/assets/buildings/vanilla_shop.png';

export const CHARACTER_PORTRAITS: Record<string, string> = {
  strawberry,
  white,
  bitter,
  milk,
  matcha,
  crunch,
  marron,
  champagne,
  peche,
  pomme,
  almond,
  honey,
  caramel,
  blueberry,
  maple,
  cinnamon,
  lemon,
  vanilla,
};

import strawberryRoom from '@/assets/interiors/strawberry_room.png';
import whiteRoom from '@/assets/interiors/white_room.png';
import bitterRoom from '@/assets/interiors/bitter_room.png';
import milkRoom from '@/assets/interiors/milk_room.png';
import matchaRoom from '@/assets/interiors/matcha_room.png';
import crunchRoom from '@/assets/interiors/crunch_room.png';
import marronRoom from '@/assets/interiors/marron_room.png';
import champagneRoom from '@/assets/interiors/champagne_room.png';
import pecheRoom from '@/assets/interiors/peche_room.png';
import pommeRoom from '@/assets/interiors/pomme_room.png';
import almondRoom from '@/assets/interiors/almond_room.png';
import honeyRoom from '@/assets/interiors/honey_room.png';
import caramelRoom from '@/assets/interiors/caramel_room.png';
import blueberryRoom from '@/assets/interiors/blueberry_room.png';
import mapleRoom from '@/assets/interiors/maple_room.png';
import cinnamonRoom from '@/assets/interiors/cinnamon_room.png';
import lemonRoom from '@/assets/interiors/lemon_room.png';
import vanillaRoom from '@/assets/interiors/vanilla_room.png';

export const SHOP_BUILDING_IMAGES: Record<string, string> = {
  strawberry: strawberryShop,
  white: whiteShop,
  bitter: bitterShop,
  milk: milkShop,
  matcha: matchaShop,
  crunch: crunchShop,
  marron: marronShop,
  champagne: champagneShop,
  peche: pecheShop,
  pomme: pommeShop,
  almond: almondShop,
  honey: honeyShop,
  caramel: caramelShop,
  blueberry: blueberryShop,
  maple: mapleShop,
  cinnamon: cinnamonShop,
  lemon: lemonShop,
  vanilla: vanillaShop,
};

// 店内マップ(16×12想定のトップビュー背景)。ユーザー提供の店舗内装イラストのうち、
// キャラクター名と一致するものをそのまま使用し、一致するものがない6店舗
// (アーモンド/ハニー/キャラメル/シナモン/レモン/バニラ)は雰囲気の近い内装を
// 仮素材として割り当てている(専用素材が届き次第差し替え可能)。
import departmentHall from '@/assets/halls/department_hall.jpg';

export const DEPARTMENT_HALL_IMAGE: string = departmentHall;

export const SHOP_ROOM_IMAGES: Record<string, string> = {
  strawberry: strawberryRoom,
  white: whiteRoom,
  bitter: bitterRoom,
  milk: milkRoom,
  matcha: matchaRoom,
  crunch: crunchRoom,
  marron: marronRoom,
  champagne: champagneRoom,
  peche: pecheRoom,
  pomme: pommeRoom,
  almond: almondRoom,
  honey: honeyRoom,
  caramel: caramelRoom,
  blueberry: blueberryRoom,
  maple: mapleRoom,
  cinnamon: cinnamonRoom,
  lemon: lemonRoom,
  vanilla: vanillaRoom,
};
