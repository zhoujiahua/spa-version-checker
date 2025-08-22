import { defineConfig } from 'tsup';

export default defineConfig({
    tsconfig: 'tsconfig.build.json', // 该文件内 module 设为 "ESNext" 或 "NodeNext"
    entry: ['src/index.ts'],
    dts: true,
    format: ['esm', 'cjs'],
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    target: 'es2020',
    treeshake: true,
    // mark UI libs as external if you reference them so consumers own the dep
    external: ['vue', 'react', 'element-plus', 'antd']
});