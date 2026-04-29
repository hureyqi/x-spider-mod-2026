import React from 'react';

const Sponsors: React.FC = () => {
  return (
    <div className="text-center text-gray-500 mt-4">
      <p>本项目为个人学习修改版</p>
      <p>本项目仅用于学习交流，请勿用于商业或非法用途。</p>
      <p>本项目目前系统代理按钮暂时无法使用,设置的时候需要启动代理并填入代理地址</p>
      <p>代理地址本机一般是http://127.0.0.1:这里填写你的代理软件端口</p>
      <p>代理软件要打开http代理,并确定端口</p>
    </div>
  );
};

export default Sponsors;