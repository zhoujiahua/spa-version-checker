#!/usr/bin/env bash

# 1) 初始化与构建
npm install
npm run build

# 2) 登录与发布
npm login
npm publish --access public
