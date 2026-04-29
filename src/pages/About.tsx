/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import Logo from '../../src-tauri/icons/128x128.png';
import { useCheckUpdate } from '../hooks/useCheckUpdate';
import { dialog } from '@tauri-apps/api';

import Sponsors from '../components/about/Sponsors';

export const About: React.FC = () => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const checkForUpdate = useCheckUpdate();

  return (
    <>
      <PageHeader />
      <section className="flex items-center">
        <img src={Logo} className="w-28" alt="logo" />
        <span className="text-5xl ml-4 font-bold">X-Spider</span>
      </section>
      <ul className="space-y-2 [&_a]:underline">
        <li>
          <strong>版本号：</strong>
          <span>{PACKAGE_JSON_VERSION}</span>
          （
          <button
            onClick={async () => {
              setIsCheckingUpdate(true);
              try {
                const hasUpdate = await checkForUpdate();
                if (!hasUpdate) {
                  dialog.message('软件已是最新版本', {
                    title: '软件已是最新版本',
                  });
                }
              } catch (err) {
                dialog.message('无法获取最新更新，请稍后再试', {
                  title: '获取更新错误',
                });
              } finally {
                setIsCheckingUpdate(false);
              }
            }}
            className="bg-transparent text-blue-500 disabled:text-gray-400"
            disabled={isCheckingUpdate}
          >
            {isCheckingUpdate ? '请稍候...' : '检查更新'}
          </button>
          ）
        </li>

        <li>
          <strong>原作者：</strong>
          <a
            href="https://github.com/MiningCattiva"
            target="_blank"
            rel="noreferrer"
          >
            MiningCattiva
          </a>
          <br />
          <strong>修改者：</strong>
          <a
            href="https://github.com/hureyqi"
            target="_blank"
            rel="noreferrer"
          >
            hureyqi
          </a>
        </li>

        <li>
          <strong>仓库地址：</strong>
          <a
            href="https://github.com/hureyqi/x-spider-mod-2026"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/hureyqi/x-spider-mod-2026
          </a>
        </li>

        <li>
          <strong>开源协议：</strong>
          <a
            href="https://github.com/MiningCattiva/x-spider/blob/master/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            {PACKAGE_JSON_LICENSE}
          </a>
        </li>

        <li>
          <strong>软件说明：</strong>
          <Sponsors />
        </li>

      </ul>
    </>
  );
};